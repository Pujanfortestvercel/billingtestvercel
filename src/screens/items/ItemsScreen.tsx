// ---------------------------------------------------------------------------
// ITEMS SCREEN — like Customers, but items have an optional default rate. When
// the admin has enabled INVENTORY for this account, items also carry stock: a
// current quantity, a reorder level, cost price, and a "Stock in / adjust"
// action. Search + paginated FlatList (scales to thousands), add/edit, delete.
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  createItem,
  deleteItem,
  fetchItemsPage,
  updateItem,
} from '../../services/itemService';
import { adjustStock, type StockReason } from '../../services/inventoryService';
import type { Item } from '../../types/models';
import { formatCurrency, toNumber } from '../../utils/format';
import { colors, fontSize, radius, spacing } from '../../theme';

const PAGE = 30;

const ADJUST_REASONS: { key: StockReason; label: string }[] = [
  { key: 'restock', label: 'Stock in' },
  { key: 'return', label: 'Return' },
  { key: 'adjustment', label: 'Correction' },
];

// --- CSV import helpers ----------------------------------------------------
// Expected columns (header optional): name, rate, stock, reorder, cost
type CsvRow = { name: string; rate: string; stock: string; reorder: string; cost: string };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Skip a header row if the first line looks like column names.
  const start = /(^|,)\s*name\s*(,|$)/i.test(lines[0]) ? 1 : 0;
  return lines.slice(start).map(line => {
    const c = splitCsvLine(line);
    return { name: c[0] ?? '', rate: c[1] ?? '', stock: c[2] ?? '', reorder: c[3] ?? '', cost: c[4] ?? '' };
  });
}

export function ItemsScreen() {
  const { user } = useAuth();
  const { inventoryEnabled } = useSubscription();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Add / edit modal.
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [trackInput, setTrackInput] = useState(false);
  const [reorderInput, setReorderInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [openingInput, setOpeningInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Stock-in / adjust modal.
  const [adjustItem, setAdjustItem] = useState<Item | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState<StockReason>('restock');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // CSV bulk import (paste).
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchItemsPage({ search: debounced, limit: PAGE, offset: 0 });
      setItems(page);
      setHasMore(page.length === PAGE);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not load items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchItemsPage({
        search: debounced,
        limit: PAGE,
        offset: items.length,
      });
      setItems(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [debounced, items.length, hasMore, loading, loadingMore]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  function openAdd() {
    setEditing(null);
    setNameInput('');
    setRateInput('');
    setTrackInput(false);
    setReorderInput('');
    setCostInput('');
    setOpeningInput('');
    setModalVisible(true);
  }
  function openEdit(it: Item) {
    setEditing(it);
    setNameInput(it.item_name);
    setRateInput(it.default_rate != null ? String(it.default_rate) : '');
    setTrackInput(!!it.track_stock);
    setReorderInput(it.reorder_level ? String(it.reorder_level) : '');
    setCostInput(it.cost_price != null ? String(it.cost_price) : '');
    setOpeningInput('');
    setModalVisible(true);
  }

  async function save() {
    const name = nameInput.trim();
    if (!name || !user) return;
    const rate = rateInput.trim() ? toNumber(rateInput) : null;
    const stockFields = inventoryEnabled
      ? {
          track_stock: trackInput,
          reorder_level: toNumber(reorderInput),
          cost_price: costInput.trim() ? toNumber(costInput) : null,
        }
      : undefined;
    setSaving(true);
    try {
      if (editing) {
        await updateItem(editing.id, { item_name: name, default_rate: rate, ...(stockFields ?? {}) });
        // Optionally add to stock from the edit screen (handy for existing items
        // you're only now starting to track).
        if (inventoryEnabled && trackInput && openingInput.trim()) {
          const add = toNumber(openingInput);
          if (add) await adjustStock(editing.id, add, 'adjustment', 'Added from edit');
        }
      } else {
        const created = await createItem(user.id, name, rate, stockFields);
        // Record opening stock as a movement so the ledger stays the source of truth.
        if (inventoryEnabled && trackInput && openingInput.trim()) {
          const opening = toNumber(openingInput);
          if (opening) await adjustStock(created.id, opening, 'opening', 'Opening stock');
        }
      }
      setModalVisible(false);
      loadFirst();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  function openAdjust(it: Item) {
    setAdjustItem(it);
    setAdjustDelta('');
    setAdjustReason('restock');
    setAdjustNote('');
  }

  async function saveAdjust() {
    if (!adjustItem) return;
    const delta = toNumber(adjustDelta);
    if (!delta) {
      Alert.alert('Enter a quantity', 'Enter a non-zero quantity (use a negative number to reduce).');
      return;
    }
    setAdjustSaving(true);
    try {
      await adjustStock(adjustItem.id, delta, adjustReason, adjustNote.trim() || undefined);
      setAdjustItem(null);
      loadFirst();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update stock.');
    } finally {
      setAdjustSaving(false);
    }
  }

  async function runImport() {
    if (!user) return;
    const parsed = parseCsv(csvText).filter(r => r.name.trim());
    if (parsed.length === 0) {
      Alert.alert('Nothing to import', 'Paste rows like: name, rate, stock, reorder, cost');
      return;
    }
    setImporting(true);
    let ok = 0;
    let failed = 0;
    for (const r of parsed) {
      try {
        const rate = r.rate.trim() ? toNumber(r.rate) : null;
        const stock = r.stock.trim() ? toNumber(r.stock) : 0;
        const reorder = r.reorder.trim() ? toNumber(r.reorder) : 0;
        const cost = r.cost.trim() ? toNumber(r.cost) : null;
        const track = inventoryEnabled && (stock !== 0 || reorder !== 0 || cost != null);
        const created = await createItem(
          user.id,
          r.name,
          rate,
          inventoryEnabled ? { track_stock: track, reorder_level: reorder, cost_price: cost } : undefined,
        );
        if (track && stock) await adjustStock(created.id, stock, 'opening', 'CSV import');
        ok++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    setImportOpen(false);
    setCsvText('');
    Alert.alert('Import complete', `Imported ${ok} item${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
    loadFirst();
  }

  function confirmDelete(it: Item) {
    Alert.alert('Delete item', `Delete "${it.item_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(it.id);
            setItems(prev => prev.filter(x => x.id !== it.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete.');
          }
        },
      },
    ]);
  }

  function renderRow({ item }: { item: Item }) {
    const tracked = inventoryEnabled && item.track_stock;
    const qty = item.stock_qty ?? 0;
    const low = tracked && qty <= (item.reorder_level ?? 0);
    return (
      <Card>
        <View style={styles.rowTop}>
          <Text style={styles.name}>{item.item_name}</Text>
          {item.default_rate != null ? (
            <Text style={styles.rate}>{formatCurrency(item.default_rate)}</Text>
          ) : null}
        </View>
        {tracked ? (
          <Text style={[styles.stockBadge, low ? styles.stockLow : styles.stockOk]}>
            {low ? '⚠️ ' : ''}In stock: {qty}
            {low ? `  · reorder at ${item.reorder_level ?? 0}` : ''}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {tracked ? (
            <Button title="Stock" variant="ghost" onPress={() => openAdjust(item)} style={styles.actionBtn} />
          ) : null}
          <Button title="Edit" variant="ghost" onPress={() => openEdit(item)} style={styles.actionBtn} />
          <Button title="Delete" variant="danger" onPress={() => confirmDelete(item)} style={styles.actionBtn} />
        </View>
      </Card>
    );
  }

  return (
    <ScreenContainer
      title="Items"
      right={
        <View style={styles.headerBtns}>
          <Button title="⬆ Import" variant="ghost" onPress={() => setImportOpen(true)} style={styles.addBtn} />
          <Button title="＋ Add" onPress={openAdd} style={styles.addBtn} />
        </View>
      }
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search items…"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={styles.search}
      />

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="📦"
          title={debounced ? 'No matches' : 'No items yet'}
          subtitle={debounced ? 'Try a different search.' : 'Add the products you sell for quick billing.'}
          actionLabel={debounced ? undefined : 'Add item'}
          onAction={debounced ? undefined : openAdd}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderRow}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFirst();
              }}
            />
          }
          ListFooterComponent={loadingMore ? <Loading /> : null}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Add / edit item */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Edit item' : 'New item'}</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Item name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={styles.search}
            />
            <TextInput
              value={rateInput}
              onChangeText={setRateInput}
              placeholder="Default rate (optional)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.search}
            />

            {inventoryEnabled ? (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Track stock for this item</Text>
                  <Switch
                    value={trackInput}
                    onValueChange={setTrackInput}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
                {trackInput ? (
                  <>
                    <TextInput
                      value={openingInput}
                      onChangeText={setOpeningInput}
                      placeholder={editing ? 'Add to stock now (optional)' : 'Opening stock'}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={styles.search}
                    />
                    <TextInput
                      value={reorderInput}
                      onChangeText={setReorderInput}
                      placeholder="Reorder level"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={styles.search}
                    />
                    <TextInput
                      value={costInput}
                      onChangeText={setCostInput}
                      placeholder="Cost price (optional)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={styles.search}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setModalVisible(false)} style={styles.modalBtn} />
              <Button title="Save" onPress={save} loading={saving} style={styles.modalBtn} />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Stock in / adjust */}
      <Modal
        visible={!!adjustItem}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustItem(null)}
      >
        <View style={styles.overlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {adjustItem ? `Stock — ${adjustItem.item_name}` : 'Stock'}
            </Text>
            <Text style={styles.currentStock}>
              Current stock: <Text style={styles.bold}>{adjustItem?.stock_qty ?? 0}</Text>
            </Text>

            <Text style={styles.fieldLabel}>Reason</Text>
            <View style={styles.chips}>
              {ADJUST_REASONS.map(r => {
                const active = r.key === adjustReason;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setAdjustReason(r.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={adjustDelta}
              onChangeText={setAdjustDelta}
              placeholder="Quantity (use a negative number to reduce)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              autoFocus
              style={styles.search}
            />
            <TextInput
              value={adjustNote}
              onChangeText={setAdjustNote}
              placeholder="Note (optional)"
              placeholderTextColor={colors.textMuted}
              style={styles.search}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setAdjustItem(null)} style={styles.modalBtn} />
              <Button title="Apply" onPress={saveAdjust} loading={adjustSaving} style={styles.modalBtn} />
            </View>
          </Card>
        </View>
      </Modal>

      {/* CSV bulk import (paste) */}
      <Modal
        visible={importOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setImportOpen(false)}
      >
        <View style={styles.overlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import items from CSV</Text>
            <Text style={styles.importHint}>
              One item per line, columns in this order (a header row is optional):{'\n'}
              <Text style={styles.mono}>name, rate, stock, reorder, cost</Text>
              {'\n'}
              {inventoryEnabled
                ? 'Rows with a stock/reorder/cost value are set to track stock automatically.'
                : 'Stock columns are ignored until an admin enables inventory.'}
            </Text>
            <TextInput
              value={csvText}
              onChangeText={setCsvText}
              placeholder={'Cement bag, 350, 100, 10, 250\nSteel rod, 500, 40, 5, 420'}
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.search, styles.csvBox]}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setImportOpen(false)} style={styles.modalBtn} />
              <Button title="Import" onPress={runImport} loading={importing} style={styles.modalBtn} />
            </View>
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBtns: { flexDirection: 'row', gap: spacing.xs },
  addBtn: { height: 38, paddingHorizontal: spacing.sm },
  importHint: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
  mono: { fontWeight: '700', color: colors.text },
  csvBox: { height: 130, textAlignVertical: 'top', paddingTop: spacing.sm },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  listContent: { paddingBottom: spacing.xl },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, flex: 1 },
  rate: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary, marginLeft: spacing.sm },
  stockBadge: { fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.xs },
  stockOk: { color: colors.success },
  stockLow: { color: colors.danger },
  actions: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm },
  actionBtn: { flex: 1, height: 40 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: { marginBottom: 0 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalBtn: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  switchLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  currentStock: { fontSize: fontSize.md, color: colors.textMuted, marginBottom: spacing.md },
  bold: { fontWeight: '800', color: colors.text },
  fieldLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600', marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.primary, fontWeight: '800' },
});
