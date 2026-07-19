// ---------------------------------------------------------------------------
// INVENTORY — the stock back-office (only reachable when the admin has enabled
// inventory for this account). Shows: total stock valuation + counts, the
// on-hand list for every tracked item (low rows highlighted), and a recent
// stock-movement feed (in / out / sale / return / adjustment).
//
// Editing stock (track on/off, reorder level, cost, stock-in / adjust) lives
// on the Items screen — this screen is read-only, like the web app.
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import {
  getInventorySummary,
  listRecentMovements,
  type InventorySummary,
  type MovementWithItem,
} from '../../services/inventoryService';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { colors, fontSize, radius, spacing } from '../../theme';

const REASON_LABEL: Record<string, string> = {
  sale: 'Sale',
  restock: 'Stock in',
  return: 'Return',
  adjustment: 'Adjustment',
  opening: 'Opening',
};

export function InventoryScreen() {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [moves, setMoves] = useState<MovementWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        getInventorySummary(),
        listRecentMovements(50),
      ]);
      setSummary(s);
      setMoves(m);
    } catch {
      // Surface a soft error state via empty summary; keep the screen usable.
      setSummary(prev => prev ?? { rows: [], totalValue: 0, trackedCount: 0, lowCount: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.back} onPress={() => navigation.goBack()}>
            ‹
          </Text>
          <Text style={styles.title}>Inventory</Text>
        </View>
        <Button
          title="Manage items"
          variant="ghost"
          onPress={() => navigation.navigate('Tabs', { screen: 'Items' })}
          style={styles.manageBtn}
        />
      </View>

      {loading ? (
        <Loading text="Loading inventory…" />
      ) : !summary || summary.trackedCount === 0 ? (
        <EmptyState
          emoji="📦"
          title="No tracked items yet"
          subtitle='Turn on "Track stock" for an item on the Items screen to start managing inventory.'
          actionLabel="Go to Items"
          onAction={() => navigation.navigate('Tabs', { screen: 'Items' })}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {/* KPI cards */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpi, styles.kpiAccent]}>
              <Text style={styles.kpiLabelAccent}>Stock value</Text>
              <Text style={styles.kpiValueAccent}>{formatCurrency(summary.totalValue)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Tracked items</Text>
              <Text style={styles.kpiValue}>{summary.trackedCount}</Text>
            </View>
            <View style={[styles.kpi, summary.lowCount > 0 && styles.kpiDanger]}>
              <Text style={styles.kpiLabel}>Low stock</Text>
              <Text style={[styles.kpiValue, summary.lowCount > 0 && styles.dangerText]}>
                {summary.lowCount}
              </Text>
            </View>
          </View>

          {/* On-hand list */}
          <Text style={styles.sectionTitle}>Stock on hand</Text>
          <Card>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colItem]}>Item</Text>
              <Text style={[styles.th, styles.colNum]}>In stock</Text>
              <Text style={[styles.th, styles.colNum]}>Reorder</Text>
              <Text style={[styles.th, styles.colNum]}>Value</Text>
            </View>
            {summary.rows.map(r => (
              <View key={r.item_id} style={styles.tr}>
                <Text style={[styles.td, styles.colItem]} numberOfLines={1}>
                  {r.low ? '⚠️ ' : ''}
                  {r.item_name}
                </Text>
                <Text style={[styles.td, styles.colNum, styles.bold, r.low && styles.dangerText]}>
                  {r.stock_qty}
                </Text>
                <Text style={[styles.td, styles.colNum, styles.muted]}>{r.reorder_level}</Text>
                <Text style={[styles.td, styles.colNum]}>
                  {r.cost_price != null ? formatCurrency(r.value) : '—'}
                </Text>
              </View>
            ))}
          </Card>

          {/* Recent movements */}
          <Text style={styles.sectionTitle}>Recent stock movements</Text>
          <Card>
            {moves.length === 0 ? (
              <Text style={styles.muted}>No stock movements yet.</Text>
            ) : (
              moves.map(m => {
                const up = m.change > 0;
                return (
                  <View key={m.id} style={styles.moveRow}>
                    <View style={styles.moveInfo}>
                      <Text style={styles.moveName} numberOfLines={1}>
                        {m.item_name ?? 'Item'}
                      </Text>
                      <Text style={styles.moveMeta} numberOfLines={1}>
                        {REASON_LABEL[m.reason] ?? m.reason}
                        {m.note ? ` · ${m.note}` : ''} · {formatDateTime(m.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.moveChange, up ? styles.successText : styles.dangerText]}>
                      {up ? '+' : ''}
                      {m.change}
                    </Text>
                  </View>
                );
              })
            )}
          </Card>
          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  back: { fontSize: 34, lineHeight: 34, color: colors.primary, fontWeight: '700', marginRight: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  manageBtn: { height: 38, paddingHorizontal: spacing.md },
  content: { padding: spacing.md },
  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kpi: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  kpiAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  kpiDanger: { borderColor: colors.danger },
  kpiLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  kpiLabelAccent: { fontSize: fontSize.sm, color: colors.white, opacity: 0.9, fontWeight: '600' },
  kpiValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  kpiValueAccent: { fontSize: fontSize.lg, fontWeight: '800', color: colors.white, marginTop: spacing.xs },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '700' },
  tr: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  td: { fontSize: fontSize.sm, color: colors.text },
  colItem: { flex: 1 },
  colNum: { width: 64, textAlign: 'right' },
  bold: { fontWeight: '700' },
  muted: { color: colors.textMuted },
  successText: { color: colors.success },
  dangerText: { color: colors.danger },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moveInfo: { flex: 1, marginRight: spacing.sm },
  moveName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  moveMeta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  moveChange: { fontSize: fontSize.md, fontWeight: '800' },
  bottomPad: { height: spacing.xl },
});
