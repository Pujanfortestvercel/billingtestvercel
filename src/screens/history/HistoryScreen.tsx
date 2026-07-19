// ---------------------------------------------------------------------------
// BILL HISTORY
// • Paginated list (newest first), grouped by day, searchable by customer.
// • Tap a bill to expand → see its items + Edit / Print / Share / Delete.
// • "Delete all" in the header.
// ---------------------------------------------------------------------------
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  deleteAllBills,
  deleteBill,
  fetchBillsPage,
  getBillItems,
} from '../../services/billService';
import { printInvoice, downloadInvoicePdf, shareInvoice } from '../../utils/invoice';
import type { Bill, BillItem } from '../../types/models';
import { formatCurrency, formatDateTime, dayLabel } from '../../utils/format';
import { colors, fontSize, radius, spacing } from '../../theme';

const PAGE = 20;

export function HistoryScreen() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [filterDate, setFilterDate] = useState('');
  const debouncedDate = useDebounce(filterDate, 300);

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, BillItem[]>>({});

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchBillsPage({
        search: debouncedQuery,
        fromDate: debouncedDate || undefined,
        toDate: debouncedDate || undefined,
        limit: PAGE,
        offset: 0,
      });
      setBills(page);
      setHasMore(page.length === PAGE);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not load bills.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQuery, debouncedDate]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchBillsPage({
        search: debouncedQuery,
        fromDate: debouncedDate || undefined,
        toDate: debouncedDate || undefined,
        limit: PAGE,
        offset: bills.length,
      });
      setBills(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [debouncedQuery, debouncedDate, bills.length, hasMore, loading, loadingMore]);

  // Reload when the screen gains focus (e.g. right after creating a bill) and
  // whenever the search text/date changes — so new bills appear immediately.
  useFocusEffect(
    useCallback(() => {
      loadFirst();
    }, [loadFirst]),
  );

  async function toggleExpand(bill: Bill) {
    if (expandedId === bill.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(bill.id);
    if (!itemsCache[bill.id]) {
      try {
        const items = await getBillItems(bill.id);
        setItemsCache(prev => ({ ...prev, [bill.id]: items }));
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Could not load bill items.');
      }
    }
  }

  async function doPrint(bill: Bill) {
    try {
      const items = itemsCache[bill.id] ?? (await getBillItems(bill.id));
      await printInvoice(bill, items, settings);
    } catch (e: any) {
      if (e?.message) Alert.alert('Print', e.message);
    }
  }

  async function doPdf(bill: Bill) {
    try {
      const items = itemsCache[bill.id] ?? (await getBillItems(bill.id));
      await downloadInvoicePdf(bill, items, settings);
    } catch (e: any) {
      if (e?.message) Alert.alert('Save as PDF', e.message);
    }
  }

  async function doShare(bill: Bill) {
    try {
      const items = itemsCache[bill.id] ?? (await getBillItems(bill.id));
      await shareInvoice(bill, items, settings);
    } catch {
      // user likely cancelled the share sheet — ignore
    }
  }

  function confirmDelete(bill: Bill) {
    if (settings?.store_type === 'medical') {
      Alert.alert('Cannot Delete', 'Government regulations for pharmacies require keeping all billing history for drug inspections.');
      return;
    }
    Alert.alert('Delete bill', `Delete bill ${bill.bill_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBill(bill.id);
            setBills(prev => prev.filter(b => b.id !== bill.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete.');
          }
        },
      },
    ]);
  }

  function confirmDeleteAll() {
    if (settings?.store_type === 'medical') {
      Alert.alert('Cannot Delete', 'Government regulations for pharmacies require keeping all billing history for drug inspections.');
      return;
    }
    if (!user || bills.length === 0) return;
    Alert.alert('Delete ALL bills', 'This permanently deletes every bill. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAllBills(user.id);
            setBills([]);
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete.');
          }
        },
      },
    ]);
  }

  function renderBill({ item, index }: { item: Bill; index: number }) {
    const showDayHeader =
      index === 0 || dayLabel(bills[index - 1].created_at) !== dayLabel(item.created_at);
    const expanded = expandedId === item.id;
    const items = itemsCache[item.id];

    return (
      <View>
        {showDayHeader ? (
          <Text style={styles.dayHeader}>{dayLabel(item.created_at)}</Text>
        ) : null}

        <Card onPress={() => toggleExpand(item)}>
          <View style={styles.billTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customer}>{item.customer_name}</Text>
              <Text style={styles.sub}>
                {item.bill_number} · {formatDateTime(item.created_at)}
              </Text>
            </View>
            <Text style={styles.amount}>{formatCurrency(item.total_amount)}</Text>
          </View>

          {expanded ? (
            <View style={styles.details}>
              {!items ? (
                <Loading />
              ) : (
                <>
                  {items.map(li => (
                    <View key={li.id} style={styles.lineRow}>
                      <Text style={styles.lineName}>{li.item_name}</Text>
                      <Text style={styles.lineMath}>
                        {li.qty} × {formatCurrency(li.rate)} = {formatCurrency(li.total)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.detailActions}>
                    <Button title="Edit" variant="ghost" onPress={() => navigation.navigate('Billing', { billId: item.id })} style={styles.detailBtn} />
                    <Button title="🖨️ Print" variant="ghost" onPress={() => doPrint(item)} style={styles.detailBtn} />
                    <Button title="📄 Save PDF" variant="ghost" onPress={() => doPdf(item)} style={styles.detailBtn} />
                    <Button title="💬 Share" variant="ghost" onPress={() => doShare(item)} style={styles.detailBtn} />
                    {settings?.store_type !== 'medical' ? (
                      <Button title="Delete" variant="danger" onPress={() => confirmDelete(item)} style={styles.detailBtn} />
                    ) : null}
                  </View>
                </>
              )}
            </View>
          ) : null}
        </Card>
      </View>
    );
  }

  return (
    <ScreenContainer
      title="Bill History"
      right={
        bills.length > 0 && settings?.store_type !== 'medical' ? (
          <Button title="Delete all" variant="danger" onPress={confirmDeleteAll} style={styles.topBtn} />
        ) : undefined
      }
    >
      <View style={styles.filterRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search customer…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          style={[styles.search, { flex: 1, marginBottom: 0 }]}
        />
        <TextInput
          value={filterDate}
          onChangeText={setFilterDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          style={styles.dateInput}
        />
        {filterDate ? (
          <Button
            title="✕"
            variant="ghost"
            onPress={() => setFilterDate('')}
            style={styles.clearBtn}
          />
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : bills.length === 0 ? (
        <EmptyState
          emoji="🗂️"
          title={debouncedQuery || debouncedDate ? 'No matches' : 'No bills yet'}
          subtitle={
            debouncedQuery || debouncedDate
              ? 'Try a different search or date.'
              : 'Create one from the Billing tab.'
          }
        />
      ) : (
        <FlatList
          data={bills}
          keyExtractor={b => b.id}
          renderItem={renderBill}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBtn: { height: 38, paddingHorizontal: spacing.md },
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
  dayHeader: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  billTop: { flexDirection: 'row', alignItems: 'center' },
  customer: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primary, marginLeft: spacing.sm },
  details: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineName: { color: colors.text, flex: 1 },
  lineMath: { color: colors.textMuted, marginLeft: spacing.sm },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  detailBtn: { flexGrow: 1, flexBasis: '40%', height: 40 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 46,
    width: 120,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlign: 'center',
  },
  clearBtn: {
    width: 36,
    height: 46,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
