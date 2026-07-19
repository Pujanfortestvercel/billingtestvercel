// ---------------------------------------------------------------------------
// CUSTOMERS SCREEN
// • Search (case-insensitive) + virtualized FlatList + pagination (30 at a
//   time) so it stays fast with thousands of customers.
// • Add / edit (modal), freeze / unfreeze, delete.
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
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
import { useDebounce } from '../../hooks/useDebounce';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomersPage,
  setFrozen,
  updateCustomerName,
} from '../../services/customerService';
import type { Customer } from '../../types/models';
import { colors, fontSize, radius, spacing } from '../../theme';

const PAGE = 30;

export function CustomersScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);

  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Add / edit modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchCustomersPage({ search: debounced, limit: PAGE, offset: 0 });
      setItems(page);
      setHasMore(page.length === PAGE);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not load customers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchCustomersPage({
        search: debounced,
        limit: PAGE,
        offset: items.length,
      });
      setItems(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE);
    } catch {
      // ignore load-more errors silently
    } finally {
      setLoadingMore(false);
    }
  }, [debounced, items.length, hasMore, loading, loadingMore]);

  // Reload whenever the (debounced) search text changes.
  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  function openAdd() {
    setEditing(null);
    setNameInput('');
    setModalVisible(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setNameInput(c.customer_name);
    setModalVisible(true);
  }

  async function save() {
    const name = nameInput.trim();
    if (!name || !user) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCustomerName(editing.id, name);
      } else {
        await createCustomer(user.id, name);
      }
      setModalVisible(false);
      loadFirst();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFreeze(c: Customer) {
    try {
      await setFrozen(c.id, !c.is_frozen);
      setItems(prev =>
        prev.map(x => (x.id === c.id ? { ...x, is_frozen: !c.is_frozen } : x)),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update.');
    }
  }

  function confirmDelete(c: Customer) {
    Alert.alert('Delete customer', `Delete "${c.customer_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer(c.id);
            setItems(prev => prev.filter(x => x.id !== c.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete.');
          }
        },
      },
    ]);
  }

  function renderRow({ item }: { item: Customer }) {
    return (
      <Card>
        <View style={styles.rowTop}>
          <Text style={styles.name}>{item.customer_name}</Text>
          {item.is_frozen ? <Text style={styles.frozen}>FROZEN</Text> : null}
        </View>
        <View style={styles.actions}>
          <Button
            title={item.is_frozen ? 'Unfreeze' : 'Freeze'}
            variant={item.is_frozen ? 'secondary' : 'ghost'}
            onPress={() => toggleFreeze(item)}
            style={styles.actionBtn}
          />
          <Button
            title="Edit"
            variant="ghost"
            onPress={() => openEdit(item)}
            style={styles.actionBtn}
          />
          <Button
            title="Delete"
            variant="danger"
            onPress={() => confirmDelete(item)}
            style={styles.actionBtn}
          />
        </View>
      </Card>
    );
  }

  return (
    <ScreenContainer
      title="Customers"
      right={<Button title="＋ Add" onPress={openAdd} style={styles.addBtn} />}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search customers…"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={styles.search}
      />

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="👥"
          title={debounced ? 'No matches' : 'No customers yet'}
          subtitle={debounced ? 'Try a different search.' : 'Tap ＋ Add to create one.'}
          actionLabel={debounced ? undefined : 'Add customer'}
          onAction={debounced ? undefined : openAdd}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={c => c.id}
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

      {/* Add / Edit modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit customer' : 'New customer'}
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Customer name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={styles.search}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Save"
                onPress={save}
                loading={saving}
                style={styles.modalBtn}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  addBtn: { height: 38, paddingHorizontal: spacing.md },
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
  frozen: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: fontSize.sm,
    marginLeft: spacing.sm,
  },
  actions: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm },
  actionBtn: { flex: 1, height: 40, paddingHorizontal: spacing.xs },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: { marginBottom: 0 },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalBtn: { flex: 1 },
});
