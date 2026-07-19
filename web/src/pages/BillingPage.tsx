// ---------------------------------------------------------------------------
// BILLING — create OR edit a bill. The form ADAPTS to the user's store type:
//   • medical  → batch no., expiry date, per-line discount % (+ expiry warning)
//   • apparel  → size/variant, HSN, per-line discount %
//   • electronics → serial/model, warranty (months)
//   • restaurant → table no., dine-in/takeaway, service charge %
//   • services → "description × hours × rate" + notes
//   • grocery  → plain item · qty · rate
// Every store also gets bill-level Discount % and Tax/GST %, with a full
// Subtotal → Discount → (Service charge) → Tax → Grand Total breakdown.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/Toast';
import { Button, Card, Spinner } from '../components/UI';
import { Autocomplete } from '../components/Autocomplete';
import {
  searchCustomers,
  findCustomerByName,
  findOrCreateCustomer,
} from '../services/customerService';
import { searchItems, findOrCreateItem } from '../services/itemService';
import {
  createBill,
  getBillWithItems,
  getNextBillNumber,
  updateBill,
} from '../services/billService';
import type { Customer, Item } from '../types/models';
import { validateBill } from '../utils/validation';
import { formatCurrency, toNumber } from '../utils/format';

type Row = {
  key: string;
  item_name: string;
  qty: string;
  rate: string;
  discount: string; // per-line %
  meta: Record<string, string>;
};

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

// Days until an ISO date (YYYY-MM-DD); negative = already past.
function daysUntil(iso: string): number {
  const d = new Date(iso + 'T00:00:00').getTime();
  return Math.ceil((d - Date.now()) / 86400000);
}

export function BillingPage() {
  const { user } = useAuth();
  const { isUsable, inventoryEnabled } = useSubscription();
  const { store } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const billId = params.get('billId');

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

  useEffect(() => {
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
        toast(e?.message ?? 'Could not load bill.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }
  function updateMeta(key: string, field: string, value: string) {
    setRows(prev =>
      prev.map(r =>
        r.key === key ? { ...r, meta: { ...r.meta, [field]: value } } : r,
      ),
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

  function startNew() {
    setParams({});
    resetForm();
  }

  async function handleSubmit() {
    if (!user || saving) return;
    // Set the flag BEFORE the first await (the customer lookup) so a fast
    // double-click / double-Enter can't start two saves and create two bills.
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
        toast('Please fix:\n' + errors.map(e => `• ${e}`).join('\n'), 'error');
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

      // Inventory: warn (but still allow — per the chosen policy) when a NEW
      // sale would take a tracked item below zero.
      if (inventoryEnabled && !editingBillId) {
        const short = validRows
          .map((r, i) => ({ item: resolvedItems[i], want: toNumber(r.qty) }))
          .filter(x => x.item.track_stock && (x.item.stock_qty ?? 0) < x.want);
        if (short.length) {
          toast(
            'Low stock (bill still saved): ' +
              short
                .map(x => `${x.item.item_name} — have ${x.item.stock_qty ?? 0}`)
                .join(', '),
            'info',
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
      if (store.billExtras.includes('notes') && notes.trim())
        extra.notes = notes.trim();

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

      toast(editingBillId ? 'Bill updated ✅' : `Bill ${billNumber} created ✅`, 'success');
      navigate('/history');
    } catch (e: any) {
      toast(e?.message ?? 'Could not save the bill.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner text="Loading bill…" />;

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="row spread" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>
          {store.emoji} {editingBillId ? 'Edit Bill' : 'New Bill'}
        </h1>
        {editingBillId ? (
          <Button title="Start new" variant="ghost" small onClick={startNew} />
        ) : null}
      </div>

      {!isUsable ? (
        <Card
          style={{
            background: 'var(--danger-soft)',
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
            marginBottom: 16,
          }}
        >
          ⚠️ Your trial/subscription has expired — billing is disabled.
        </Card>
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <div className="row spread" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="muted">
            Bill #: <strong style={{ color: 'var(--text)' }}>{billNumber}</strong>
          </div>
          <span className="badge badge-primary">{store.label}</span>
        </div>
      </Card>

      {/* Restaurant order header */}
      {store.billExtras.includes('table_no') ||
      store.billExtras.includes('order_type') ? (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {store.billExtras.includes('table_no') ? (
              <div>
                <label className="field-label">Table / Order no.</label>
                <input
                  className="input"
                  value={tableNo}
                  onChange={e => setTableNo(e.target.value)}
                  placeholder="e.g. T-5"
                />
              </div>
            ) : null}
            {store.billExtras.includes('order_type') ? (
              <div>
                <label className="field-label">Order type</label>
                <select
                  className="input"
                  value={orderType}
                  onChange={e => setOrderType(e.target.value)}
                >
                  <option value="dine-in">Dine-in</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Autocomplete<Customer>
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
        <div className="field-error" style={{ marginTop: -8, marginBottom: 12 }}>
          This customer is FROZEN and cannot be billed.
        </div>
      ) : null}

      <h3 style={{ marginBottom: 10 }}>Items</h3>
      {rows.map((row, index) => {
        const expiry = row.meta.expiry_date;
        const rawExpDays = store.expiryAlerts && expiry ? daysUntil(expiry) : null;
        // A malformed stored expiry date yields NaN — don't render "in NaN days".
        const expDays =
          rawExpDays !== null && Number.isFinite(rawExpDays) ? rawExpDays : null;
        return (
          <Card key={row.key}>
            <div className="row spread" style={{ marginBottom: 10 }}>
              <strong className="muted">Row {index + 1}</strong>
              {rows.length > 1 ? (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ border: 'none', color: 'var(--danger)', padding: '0 8px' }}
                  onClick={() => removeRow(row.key)}
                >
                  Remove ✕
                </button>
              ) : null}
            </div>

            <Autocomplete<Item>
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

            {/* Store-specific extra fields */}
            {store.lineFields.length ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${store.lineFields.length}, 1fr)`,
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {store.lineFields.map(f => (
                  <div key={f.key}>
                    <label className="field-label">{f.label}</label>
                    <input
                      className="input"
                      type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                      value={row.meta[f.key] ?? ''}
                      placeholder={f.placeholder}
                      onChange={e => updateMeta(row.key, f.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {expDays !== null ? (
              <div
                style={{
                  marginBottom: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  color: expDays < 0 ? 'var(--danger)' : expDays <= 30 ? 'var(--warning)' : 'var(--text-muted)',
                }}
              >
                {expDays < 0
                  ? `⛔ Expired ${Math.abs(expDays)} day(s) ago`
                  : expDays <= 30
                  ? `⚠️ Expires in ${expDays} day(s)`
                  : `✓ Expires in ${expDays} day(s)`}
              </div>
            ) : null}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: store.lineDiscount
                  ? '1fr 1fr 1fr 1.2fr'
                  : '1fr 1fr 1.2fr',
                gap: 10,
              }}
            >
              <div>
                <label className="field-label">{store.qtyLabel}</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={row.qty}
                  placeholder="0"
                  onChange={e => updateRow(row.key, { qty: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Rate</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={row.rate}
                  placeholder="0"
                  onChange={e => updateRow(row.key, { rate: e.target.value })}
                />
              </div>
              {store.lineDiscount ? (
                <div>
                  <label className="field-label">Disc %</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={row.discount}
                    placeholder="0"
                    onChange={e => updateRow(row.key, { discount: e.target.value })}
                  />
                </div>
              ) : null}
              <div>
                <label className="field-label">Total</label>
                <div
                  className="input"
                  style={{ display: 'flex', alignItems: 'center', fontWeight: 700, background: 'var(--surface-2)' }}
                >
                  {formatCurrency(lineTotal(row))}
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <div style={{ marginTop: 6 }}>
        <Button title="＋ Add item" variant="ghost" onClick={addRow} />
      </div>

      {/* Charges */}
      <Card style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Charges</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: store.billExtras.includes('service_charge')
              ? '1fr 1fr 1fr'
              : '1fr 1fr',
            gap: 12,
          }}
        >
          <div>
            <label className="field-label">Discount %</label>
            <input
              className="input"
              inputMode="decimal"
              value={billDiscount}
              placeholder="0"
              onChange={e => setBillDiscount(e.target.value)}
            />
          </div>
          {store.billExtras.includes('service_charge') ? (
            <div>
              <label className="field-label">Service charge %</label>
              <input
                className="input"
                inputMode="decimal"
                value={serviceCharge}
                placeholder="0"
                onChange={e => setServiceCharge(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label className="field-label">Tax / GST %</label>
            <input
              className="input"
              inputMode="decimal"
              value={tax}
              placeholder="0"
              onChange={e => setTax(e.target.value)}
            />
          </div>
        </div>

        {store.billExtras.includes('notes') ? (
          <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label className="field-label">Notes</label>
            <textarea
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes for this bill"
              rows={2}
              style={{ height: 'auto', padding: 12, resize: 'vertical' }}
            />
          </div>
        ) : null}
      </Card>

      {/* Totals breakdown */}
      <Card style={{ marginTop: 16 }}>
        <Line label="Subtotal" value={formatCurrency(subtotal)} />
        {discountAmount > 0 ? (
          <Line label={`Discount (${discountPct}%)`} value={'– ' + formatCurrency(discountAmount)} />
        ) : null}
        {serviceChargeAmount > 0 ? (
          <Line label={`Service charge (${scPct}%)`} value={'+ ' + formatCurrency(serviceChargeAmount)} />
        ) : null}
        {taxAmount > 0 ? (
          <Line label={`Tax / GST (${taxPct}%)`} value={'+ ' + formatCurrency(taxAmount)} />
        ) : null}
        <div
          className="row spread"
          style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}
        >
          <strong style={{ fontSize: 18 }}>Grand Total</strong>
          <strong style={{ fontSize: 24, color: 'var(--primary)' }}>
            {formatCurrency(grandTotal)}
          </strong>
        </div>
      </Card>

      <div style={{ marginTop: 18 }}>
        <Button
          title={editingBillId ? 'Update Bill' : 'Generate Bill'}
          block
          loading={saving}
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="row spread" style={{ padding: '4px 0' }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
