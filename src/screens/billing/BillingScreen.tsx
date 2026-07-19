// ---------------------------------------------------------------------------
// BILLING SCREEN — create OR edit a bill. The form ADAPTS to the user's store
// type (from Settings):
//   • medical      → batch no., expiry date, per-line discount % (+ expiry warn)
//   • apparel      → size/variant, HSN, per-line discount %
//   • electronics  → serial/model, warranty (months)
//   • restaurant   → table no., dine-in/takeaway/delivery, service charge %
//   • services     → "description × hours × rate" + notes
//   • grocery      → plain item · qty · rate
// Every store also gets bill-level Discount % and Tax/GST %, with a full
// Subtotal → Discount → (Service charge) → Tax → Grand Total breakdown. Each
// line is linked to a real item (item_id) so tracked stock adjusts automatically.
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { AutocompleteInput } from '../../components/common/AutocompleteInput';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useSettings } from '../../context/SettingsContext';
import type { AppTabsParamList } from '../../navigation/types';
import { searchCustomers, findCustomerByName, findOrCreateCustomer } from '../../services/customerService';
import { searchItems, findOrCreateItem } from '../../services/itemService';
import {
  createBill,
  getBillWithItems,
  getNextBillNumber,
  updateBill,
} from '../../services/billService';
import type { Customer, Item } from '../../types/models';
import { validateBill } from '../../utils/validation';
import { formatCurrency, toNumber } from '../../utils/format';
import { colors, fontSize, radius, spacing } from '../../theme';

type Row = {
  key: string;
  item_name: string;
  qty: string;
  rate: string;
  discount: string; // per-line %
  meta: Record<string, string>;
};

const ORDER_TYPES = ['dine-in', 'takeaway', 'delivery'];

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

// Days until an ISO date (YYYY-MM-DD); negative = already past.
function daysUntil(iso: string): number {
  const d = new Date(iso + 'T00:00:00').getTime();
  return Math.ceil((d - Date.now()) / 86400000);
}

export function BillingScreen() {
  const { user } = useAuth();
  const { isUsable, inventoryEnabled } = useSubscription();
  const { store } = useSettings();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AppTabsParamList, 'Billing'>>();

  const keyRef = useRef(0);
  const newKey = () => String(keyRef.current++);
  const emptyRow = (): Row => ({
    key: newKey(),
    item_name: '',
    qty: '',
    rate: '',
    discount: '',
    meta: {},
  });

  const [billNumber, setBillNumber] = useState('…');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  // Bill-level charges + per-store extras.
  const [billDiscount, setBillDiscount] = useState(''); // %
  const [tax, setTax] = useState(''); // %
  const [serviceCharge, setServiceCharge] = useState(''); // %
  const [tableNo, setTableNo] = useState('');
  const [orderType, setOrderType] = useState('dine-in');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(async () => {
    setEditingBillId(null);
    setCustomerName('');
    setSelectedCustomer(null);
    setRows([emptyRow()]);
    setBillDiscount('');
    setTax('');
    setServiceCharge('');
    setTableNo('');
    setOrderType('dine-in');
    setNotes('');
    try {
      setBillNumber(await getNextBillNumber());
    } catch {
      setBillNumber('INV-1001');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load an existing bill when opened in edit mode; otherwise suggest a number.
  useEffect(() => {
    const billId = route.params?.billId;
    if (!billId) {
      resetForm();
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const bill = await getBillWithItems(billId);
        if (!active) return;
        const extra = bill.extra ?? {};
        setEditingBillId(bill.id);
        setBillNumber(bill.bill_number);
        setCustomerName(bill.customer_name);
        setSelectedCustomer(null);
        setBillDiscount(extra.discount_percent ? String(extra.discount_percent) : '');
        setTax(bill.tax_percent ? String(bill.tax_percent) : '');
        setServiceCharge(
          extra.service_charge_percent ? String(extra.service_charge_percent) : '',
        );
        setTableNo(extra.table_no ?? '');
        setOrderType(extra.order_type ?? 'dine-in');
        setNotes(extra.notes ?? '');
        setRows(
          bill.items.length
            ? bill.items.map(it => ({
                key: newKey(),
                item_name: it.item_name,
                qty: String(it.qty),
                rate: String(it.rate),
                discount: it.discount ? String(it.discount) : '',
                meta: { ...(it.meta ?? {}) },
              }))
            : [emptyRow()],
        );
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Could not load bill.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.billId]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }
  function updateMeta(key: string, field: string, value: string) {
    setRows(prev =>
      prev.map(r => (r.key === key ? { ...r, meta: { ...r.meta, [field]: value } } : r)),
    );
  }
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (key: string) =>
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev));

  // ---- Totals -------------------------------------------------------------
  const lineTotal = (r: Row) => {
    const base = toNumber(r.qty) * toNumber(r.rate);
    const d = store.lineDiscount ? clampPct(toNumber(r.discount)) : 0;
    return base * (1 - d / 100);
  };
  const subtotal = rows.reduce((s, r) => s + lineTotal(r), 0);
  const discountPct = clampPct(toNumber(billDiscount));
  const discountAmount = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmount;
  const scPct = store.billExtras.includes('service_charge')
    ? clampPct(toNumber(serviceCharge))
    : 0;
  const serviceChargeAmount = afterDiscount * (scPct / 100);
  const taxable = afterDiscount + serviceChargeAmount;
  const taxPct = clampPct(toNumber(tax));
  const taxAmount = taxable * (taxPct / 100);
  const grandTotal = taxable + taxAmount;

  async function handleSubmit() {
    if (!user || saving) return;
    // Set the flag BEFORE the first await (the customer lookup) so a fast
    // double-tap can't start two saves and create two bills.
    setSaving(true);
    try {
      let existing: Customer | null = selectedCustomer;
      if (!existing && customerName.trim()) {
        try {
          existing = await findCustomerByName(customerName);
        } catch {
          existing = null;
        }
      }

      const errors = validateBill({
        customerName,
        rows: rows.map(r => ({ item_name: r.item_name, qty: r.qty, rate: r.rate })),
        isFrozen: !!existing?.is_frozen,
        isSubscriptionActive: isUsable,
      });
      if (errors.length > 0) {
        Alert.alert('Please fix the following', errors.map(e => `•  ${e}`).join('\n'));
        return;
      }

      const customer = existing ?? (await findOrCreateCustomer(user.id, customerName));
      const validRows = rows.filter(
        r => r.item_name.trim() && r.qty.trim() && r.rate.trim(),
      );

      // Resolve every line to a real item (creating new ones) so each bill line
      // carries an item_id — the DB then adjusts stock automatically for any
      // item that is tracked.
      const resolvedItems = await Promise.all(
        validRows.map(r => findOrCreateItem(user.id, r.item_name, toNumber(r.rate))),
      );

      // Inventory: warn (but still allow) when a NEW sale would take a tracked
      // item below zero.
      if (inventoryEnabled && !editingBillId) {
        const short = validRows
          .map((r, i) => ({ item: resolvedItems[i], want: toNumber(r.qty) }))
          .filter(x => x.item.track_stock && (x.item.stock_qty ?? 0) < x.want);
        if (short.length) {
          Alert.alert(
            'Low stock',
            'Bill will still be saved:\n' +
              short.map(x => `• ${x.item.item_name} — have ${x.item.stock_qty ?? 0}`).join('\n'),
          );
        }
      }

      const billItems = validRows.map((r, i) => {
        const qty = toNumber(r.qty);
        const rate = toNumber(r.rate);
        const d = store.lineDiscount ? clampPct(toNumber(r.discount)) : 0;
        // Keep only meta keys that actually have a value.
        const meta: Record<string, string> = {};
        Object.entries(r.meta).forEach(([k, v]) => {
          if (v && v.trim()) meta[k] = v.trim();
        });
        return {
          item_id: resolvedItems[i].id,
          item_name: r.item_name.trim(),
          qty,
          rate,
          discount: d,
          total: qty * rate * (1 - d / 100),
          meta,
        };
      });

      const extra: Record<string, unknown> = { store_type: store.key };
      if (discountPct) extra.discount_percent = discountPct;
      if (scPct) {
        extra.service_charge_percent = scPct;
        extra.service_charge_amount = serviceChargeAmount;
      }
      if (store.billExtras.includes('table_no') && tableNo.trim())
        extra.table_no = tableNo.trim();
      if (store.billExtras.includes('order_type')) extra.order_type = orderType;
      if (store.billExtras.includes('notes') && notes.trim()) extra.notes = notes.trim();

      const input = {
        customerId: customer.id,
        customerName: customer.customer_name,
        billNumber,
        total: grandTotal,
        subtotal,
        discountAmount,
        taxPercent: taxPct,
        taxAmount,
        extra,
        items: billItems,
      };

      if (editingBillId) await updateBill(editingBillId, input);
      else await createBill(user.id, input);

      Alert.alert('Saved ✅', editingBillId ? 'Bill updated.' : `Bill ${billNumber} created.`);
      await resetForm();
      navigation.navigate('History');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save the bill.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading text="Loading bill…" />;

  const showOrderHeader =
    store.billExtras.includes('table_no') || store.billExtras.includes('order_type');

  return (
    <ScreenContainer
      title={editingBillId ? 'Edit Bill' : 'New Bill'}
      scroll
      right={
        editingBillId ? (
          <Button title="New" variant="ghost" onPress={resetForm} style={styles.topBtn} />
        ) : undefined
      }
    >
      {!isUsable ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            ⚠️ Your trial/subscription has expired — billing is disabled.
          </Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          Bill #: <Text style={styles.metaStrong}>{billNumber}</Text>
        </Text>
        <Text style={styles.storeBadge}>
          {store.emoji} {store.label}
        </Text>
      </View>

      {/* Restaurant order header */}
      {showOrderHeader ? (
        <Card>
          {store.billExtras.includes('table_no') ? (
            <>
              <Text style={styles.fieldLabel}>Table / Order no.</Text>
              <TextInput
                value={tableNo}
                onChangeText={setTableNo}
                placeholder="e.g. T-5"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            </>
          ) : null}
          {store.billExtras.includes('order_type') ? (
            <>
              <Text style={styles.fieldLabel}>Order type</Text>
              <View style={styles.chips}>
                {ORDER_TYPES.map(t => {
                  const active = t === orderType;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setOrderType(t)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Card>
      ) : null}

      {/* Customer */}
      <AutocompleteInput<Customer>
        label="Customer"
        value={customerName}
        onChangeText={t => {
          setCustomerName(t);
          setSelectedCustomer(null);
        }}
        fetchSuggestions={q => searchCustomers(q)}
        getKey={c => c.id}
        getLabel={c => c.customer_name}
        onSelect={c => {
          setCustomerName(c.customer_name);
          setSelectedCustomer(c);
        }}
        placeholder="Type or pick a customer"
      />
      {selectedCustomer?.is_frozen ? (
        <Text style={styles.frozenWarn}>This customer is FROZEN and cannot be billed.</Text>
      ) : null}

      {/* Item rows */}
      <Text style={styles.sectionTitle}>Items</Text>
      {rows.map((row, index) => {
        const rawExpDays =
          store.expiryAlerts && row.meta.expiry_date ? daysUntil(row.meta.expiry_date) : null;
        const expDays = rawExpDays !== null && Number.isFinite(rawExpDays) ? rawExpDays : null;
        return (
          <Card key={row.key}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>Row {index + 1}</Text>
              {rows.length > 1 ? (
                <Pressable onPress={() => removeRow(row.key)}>
                  <Text style={styles.remove}>Remove ✕</Text>
                </Pressable>
              ) : null}
            </View>

            <AutocompleteInput<Item>
              label={store.itemLabel}
              value={row.item_name}
              onChangeText={t => updateRow(row.key, { item_name: t })}
              fetchSuggestions={q => searchItems(q)}
              getKey={it => it.id}
              getLabel={it => it.item_name}
              onSelect={it =>
                updateRow(row.key, {
                  item_name: it.item_name,
                  rate:
                    row.rate.trim() === '' && it.default_rate != null
                      ? String(it.default_rate)
                      : row.rate,
                })
              }
              placeholder={`${store.itemLabel} name`}
            />

            {/* Store-specific per-line fields (batch/expiry, size/HSN, serial…) */}
            {store.lineFields.map(f => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  value={row.meta[f.key] ?? ''}
                  onChangeText={v => updateMeta(row.key, f.key, v)}
                  placeholder={f.placeholder ?? (f.type === 'date' ? 'YYYY-MM-DD' : '')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={
                    f.type === 'number'
                      ? 'numeric'
                      : f.type === 'date'
                      ? 'numbers-and-punctuation'
                      : 'default'
                  }
                  style={styles.input}
                />
              </View>
            ))}

            {expDays !== null ? (
              <Text
                style={[
                  styles.expiry,
                  expDays < 0 ? styles.dangerText : expDays <= 30 ? styles.warnText : styles.mutedText,
                ]}
              >
                {expDays < 0
                  ? `⛔ Expired ${Math.abs(expDays)} day(s) ago`
                  : expDays <= 30
                  ? `⚠️ Expires in ${expDays} day(s)`
                  : `✓ Expires in ${expDays} day(s)`}
              </Text>
            ) : null}

            <View style={styles.qtyRate}>
              <View style={styles.qtyRateField}>
                <Text style={styles.smallLabel}>{store.qtyLabel}</Text>
                <TextInput
                  value={row.qty}
                  onChangeText={t => updateRow(row.key, { qty: t })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={styles.smallInput}
                />
              </View>
              <View style={styles.qtyRateField}>
                <Text style={styles.smallLabel}>Rate</Text>
                <TextInput
                  value={row.rate}
                  onChangeText={t => updateRow(row.key, { rate: t })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={styles.smallInput}
                />
              </View>
              {store.lineDiscount ? (
                <View style={styles.qtyRateField}>
                  <Text style={styles.smallLabel}>Disc %</Text>
                  <TextInput
                    value={row.discount}
                    onChangeText={t => updateRow(row.key, { discount: t })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.smallInput}
                  />
                </View>
              ) : null}
              <View style={styles.qtyRateField}>
                <Text style={styles.smallLabel}>Total</Text>
                <Text style={styles.lineTotal}>{formatCurrency(lineTotal(row))}</Text>
              </View>
            </View>
          </Card>
        );
      })}

      <Button title="＋ Add item" variant="ghost" onPress={addRow} style={styles.addItem} />

      {/* Charges */}
      <Text style={styles.sectionTitle}>Charges</Text>
      <Card>
        <View style={styles.chargesRow}>
          <View style={styles.chargeField}>
            <Text style={styles.smallLabel}>Discount %</Text>
            <TextInput
              value={billDiscount}
              onChangeText={setBillDiscount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={styles.smallInput}
            />
          </View>
          {store.billExtras.includes('service_charge') ? (
            <View style={styles.chargeField}>
              <Text style={styles.smallLabel}>Service %</Text>
              <TextInput
                value={serviceCharge}
                onChangeText={setServiceCharge}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={styles.smallInput}
              />
            </View>
          ) : null}
          <View style={styles.chargeField}>
            <Text style={styles.smallLabel}>Tax / GST %</Text>
            <TextInput
              value={tax}
              onChangeText={setTax}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={styles.smallInput}
            />
          </View>
        </View>

        {store.billExtras.includes('notes') ? (
          <View style={styles.notesWrap}>
            <Text style={styles.smallLabel}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes for this bill"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </View>
        ) : null}
      </Card>

      {/* Totals breakdown */}
      <Card style={styles.totalsCard}>
        <TotalsLine label="Subtotal" value={formatCurrency(subtotal)} />
        {discountAmount > 0 ? (
          <TotalsLine label={`Discount (${discountPct}%)`} value={'– ' + formatCurrency(discountAmount)} />
        ) : null}
        {serviceChargeAmount > 0 ? (
          <TotalsLine label={`Service charge (${scPct}%)`} value={'+ ' + formatCurrency(serviceChargeAmount)} />
        ) : null}
        {taxAmount > 0 ? (
          <TotalsLine label={`Tax / GST (${taxPct}%)`} value={'+ ' + formatCurrency(taxAmount)} />
        ) : null}
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Grand Total</Text>
          <Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text>
        </View>
      </Card>

      <Button
        title={editingBillId ? 'Update Bill' : 'Generate Bill'}
        onPress={handleSubmit}
        loading={saving}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

function TotalsLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalsLine}>
      <Text style={styles.totalsLabel}>{label}</Text>
      <Text style={styles.totalsValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBtn: { height: 38, paddingHorizontal: spacing.md },
  banner: {
    backgroundColor: '#FEF2F2',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { color: colors.danger, fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  meta: { color: colors.textMuted, fontSize: fontSize.md },
  metaStrong: { color: colors.text, fontWeight: '700' },
  storeBadge: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: fontSize.sm,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  frozenWarn: { color: colors.danger, fontWeight: '600', marginBottom: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  fieldLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600', marginBottom: spacing.xs },
  input: {
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
  textarea: { height: 72, textAlignVertical: 'top', paddingTop: spacing.sm },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rowLabel: { fontWeight: '700', color: colors.textMuted },
  remove: { color: colors.danger, fontWeight: '700' },
  expiry: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.sm },
  qtyRate: { flexDirection: 'row', gap: spacing.sm },
  qtyRateField: { flex: 1 },
  smallLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: '600' },
  smallInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
    fontSize: fontSize.md,
    color: colors.text,
  },
  lineTotal: {
    height: 44,
    textAlignVertical: 'center',
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    paddingTop: spacing.sm,
  },
  addItem: { marginTop: spacing.xs },
  chargesRow: { flexDirection: 'row', gap: spacing.sm },
  chargeField: { flex: 1 },
  notesWrap: { marginTop: spacing.sm },
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
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: colors.primary, fontWeight: '800' },
  totalsCard: { marginTop: spacing.md },
  totalsLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  totalsLabel: { color: colors.textMuted, fontSize: fontSize.md },
  totalsValue: { fontWeight: '600', color: colors.text, fontSize: fontSize.md },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grandLabel: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  grandValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primary },
  dangerText: { color: colors.danger },
  warnText: { color: colors.warning },
  mutedText: { color: colors.textMuted },
  submit: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
