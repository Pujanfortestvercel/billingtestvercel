// ---------------------------------------------------------------------------
// INVENTORY — the stock back-office (only reachable when the admin has enabled
// inventory for this account). Shows: total stock valuation + counts, the
// on-hand table for every tracked item (low rows highlighted), and a recent
// stock-movement feed (in / out / sale / return / adjustment).
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Spinner, Modal, TextField } from '../components/UI';
import {
  getInventorySummary,
  listRecentMovements,
  adjustStock,
  type InventorySummary,
  type MovementWithItem,
  type StockReason,
} from '../services/inventoryService';
import { formatCurrency, formatDateTime, toNumber } from '../utils/format';

const REASON_LABEL: Record<string, string> = {
  sale: 'Sale',
  restock: 'Stock in',
  return: 'Return',
  adjustment: 'Adjustment',
  opening: 'Opening',
};

export function InventoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [moves, setMoves] = useState<MovementWithItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock-in / adjust modal.
  const [adjustItem, setAdjustItem] = useState<{ id: string; item_name: string; stock_qty: number } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState<StockReason>('restock');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  async function saveAdjust() {
    if (!adjustItem) return;
    const delta = toNumber(adjustDelta);
    if (!delta) {
      toast('Enter a non-zero quantity (use a negative number to reduce).', 'error');
      return;
    }
    setAdjustSaving(true);
    try {
      await adjustStock(adjustItem.id, delta, adjustReason, adjustNote.trim() || undefined);
      setAdjustItem(null);
      setAdjustDelta('');
      setAdjustNote('');
      toast('Stock updated.', 'success');
      load();
    } catch (e: any) {
      toast(e?.message ?? 'Could not update stock.', 'error');
    } finally {
      setAdjustSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        getInventorySummary(),
        listRecentMovements(50),
      ]);
      setSummary(s);
      setMoves(m);
    } catch (e: any) {
      toast(e?.message ?? 'Could not load inventory.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner text="Loading inventory…" />;

  if (!summary || summary.trackedCount === 0) {
    return (
      <div>
        <h1 style={{ marginTop: 0 }}>Inventory</h1>
        <EmptyState
          emoji="📦"
          title="No tracked items yet"
          subtitle="Turn on “Track stock” for an item on the Items page to start managing inventory."
          actionLabel="Go to Items"
          onAction={() => navigate('/items')}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0 }}>Inventory</h1>
        <Button title="Manage items" variant="ghost" small onClick={() => navigate('/items')} />
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <Kpi label="Stock value" value={formatCurrency(summary.totalValue)} accent />
        <Kpi label="Tracked items" value={String(summary.trackedCount)} />
        <Kpi label="Low stock" value={String(summary.lowCount)} danger={summary.lowCount > 0} />
      </div>

      {/* On-hand / valuation table */}
      <Card style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Stock on hand</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>
                <th style={{ padding: '8px 8px' }}>Item</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>In stock</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Reorder</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Cost</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Value</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map(r => (
                <tr key={r.item_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 8px' }}>
                    {r.low ? '⚠️ ' : ''}
                    {r.item_name}
                  </td>
                  <td
                    style={{
                      padding: '9px 8px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: r.low ? 'var(--danger)' : undefined,
                    }}
                  >
                    {r.stock_qty}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {r.reorder_level}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                    {r.cost_price != null ? formatCurrency(r.cost_price) : '—'}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                    {r.cost_price != null ? formatCurrency(r.value) : '—'}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                    <Button
                      title="Adjust"
                      variant="ghost"
                      small
                      onClick={() =>
                        setAdjustItem({
                          id: r.item_id,
                          item_name: r.item_name,
                          stock_qty: r.stock_qty,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent movements */}
      <Card>
        <h3 style={{ marginTop: 0 }}>Recent stock movements</h3>
        {moves.length === 0 ? (
          <p className="muted">No stock movements yet.</p>
        ) : (
          moves.map(m => {
            const up = m.change > 0;
            return (
              <div
                key={m.id}
                className="row spread"
                style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{m.item_name ?? 'Item'}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {REASON_LABEL[m.reason] ?? m.reason}
                    {m.note ? ` · ${m.note}` : ''} · {formatDateTime(m.created_at)}
                  </div>
                </div>
                <strong
                  style={{
                    whiteSpace: 'nowrap',
                    color: up ? 'var(--success, #16a34a)' : 'var(--danger)',
                  }}
                >
                  {up ? '+' : ''}
                  {m.change}
                </strong>
              </div>
            );
          })
        )}
      </Card>

      {/* Stock in / adjust */}
      <Modal
        open={!!adjustItem}
        title={adjustItem ? `Stock — ${adjustItem.item_name}` : 'Stock'}
        onClose={() => setAdjustItem(null)}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Current stock: <strong>{adjustItem?.stock_qty ?? 0}</strong>
        </p>
        <div className="field">
          <label className="field-label">Reason</label>
          <select
            className="input"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value as StockReason)}
          >
            <option value="restock">Stock in (received)</option>
            <option value="return">Customer return</option>
            <option value="adjustment">Correction / adjustment</option>
          </select>
        </div>
        <TextField
          label="Quantity (use a negative number to reduce)"
          value={adjustDelta}
          inputMode="decimal"
          autoFocus
          onChange={e => setAdjustDelta(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveAdjust()}
          placeholder="e.g. 50  or  -3"
        />
        <TextField
          label="Note (optional)"
          value={adjustNote}
          onChange={e => setAdjustNote(e.target.value)}
          placeholder="e.g. Supplier invoice #123"
        />
        <div className="row gap-sm" style={{ marginTop: 8 }}>
          <Button title="Cancel" variant="ghost" block onClick={() => setAdjustItem(null)} />
          <Button title="Apply" block loading={adjustSaving} onClick={saveAdjust} />
        </div>
      </Modal>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <Card
      style={
        accent
          ? { background: 'var(--primary)', color: '#fff', border: 'none' }
          : danger
          ? { borderColor: 'var(--danger)' }
          : undefined
      }
    >
      <div
        style={{ fontSize: 13, fontWeight: 600, opacity: accent ? 0.85 : 1 }}
        className={accent ? '' : 'muted'}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          marginTop: 6,
          color: danger ? 'var(--danger)' : undefined,
        }}
      >
        {value}
      </div>
    </Card>
  );
}
