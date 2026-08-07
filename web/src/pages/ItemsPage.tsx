// ---------------------------------------------------------------------------
// ITEMS — like Customers, but items have an optional default rate. When the
// admin has enabled INVENTORY for this account, items also carry stock: a
// current quantity, a reorder level, cost price, and a "Stock in / adjust"
// action. Search + paginated list, add/edit modal, delete.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Modal, Spinner, TextField } from '../components/UI';
import {
  createItem,
  deleteItem,
  fetchItemsPage,
  getItemCount,
  updateItem,
} from '../services/itemService';
import { adjustStock, type StockReason } from '../services/inventoryService';
import type { Item } from '../types/models';
import { formatCurrency, toNumber } from '../utils/format';

const PAGE = 30;

// --- CSV import helpers ---------------------------------------------------
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
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Skip a header row if the first line looks like column names.
  const start = /(^|,)\s*name\s*(,|$)/i.test(lines[0]) ? 1 : 0;
  return lines.slice(start).map(line => {
    const c = splitCsvLine(line);
    return { name: c[0] ?? '', rate: c[1] ?? '', stock: c[2] ?? '', reorder: c[3] ?? '', cost: c[4] ?? '' };
  });
}

import { StorefrontUnlockCard } from '../components/StorefrontUnlockCard';

export function ItemsPage() {
  const { user } = useAuth();
  const { inventoryEnabled } = useSubscription();
  const { toast, confirm } = useToast();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Add / edit modal.
  const [modalOpen, setModalOpen] = useState(false);
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

  // CSV bulk import.
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const [totalItemCount, setTotalItemCount] = useState(0);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchItemsPage({ search: debounced, limit: PAGE, offset: 0 });
      setItems(page);
      setHasMore(page.length === PAGE);
      const count = await getItemCount();
      setTotalItemCount(count);
    } catch (e: any) {
      toast(e?.message ?? 'Could not load items.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debounced, toast]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  async function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchItemsPage({ search: debounced, limit: PAGE, offset: items.length });
      setItems(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE);
    } finally {
      setLoadingMore(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setNameInput('');
    setRateInput('');
    setTrackInput(true);
    setReorderInput('');
    setCostInput('');
    setOpeningInput('');
    setModalOpen(true);
  }
  function openEdit(it: Item) {
    setEditing(it);
    setNameInput(it.item_name);
    setRateInput(it.default_rate != null ? String(it.default_rate) : '');
    setTrackInput(!!it.track_stock);
    setReorderInput(it.reorder_level ? String(it.reorder_level) : '');
    setCostInput(it.cost_price != null ? String(it.cost_price) : '');
    setOpeningInput('');
    setModalOpen(true);
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
      setModalOpen(false);
      toast(editing ? 'Item updated.' : 'Item added.', 'success');
      loadFirst();
    } catch (e: any) {
      toast(e?.message ?? 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  }

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
      toast('Stock updated.', 'success');
      loadFirst();
    } catch (e: any) {
      toast(e?.message ?? 'Could not update stock.', 'error');
    } finally {
      setAdjustSaving(false);
    }
  }

  async function runImport() {
    if (!user) return;
    const parsed = parseCsv(csvText).filter(r => r.name.trim());
    if (parsed.length === 0) {
      toast('Nothing to import — paste rows like: name, rate, stock, reorder, cost', 'error');
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
        const track = true;
        const created = await createItem(
          user.id,
          r.name,
          rate,
          inventoryEnabled
            ? { track_stock: track, reorder_level: reorder, cost_price: cost }
            : undefined,
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
    toast(
      `Imported ${ok} item${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`,
      failed ? 'error' : 'success',
    );
    loadFirst();
  }

  async function remove(it: Item) {
    if (!(await confirm('Delete item', `Delete "${it.item_name}"?`, { danger: true }))) return;
    try {
      await deleteItem(it.id);
      setItems(prev => prev.filter(x => x.id !== it.id));
      toast('Item deleted.', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not delete.', 'error');
    }
  }

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Items</h1>
        <div className="row gap-sm">
          <Button title="⬆ Import CSV" variant="ghost" onClick={() => setImportOpen(true)} />
          <Button title="+ Add item" onClick={openAdd} />
        </div>
      </div>

      <StorefrontUnlockCard itemCount={totalItemCount} />

      <input
        className="input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search items…"
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="📦"
          title={debounced ? 'No matches' : 'No items yet'}
          subtitle={debounced ? 'Try a different search.' : 'Add the products you sell for quick billing.'}
          actionLabel={debounced ? undefined : 'Add item'}
          onAction={debounced ? undefined : openAdd}
        />
      ) : (
        <>
          {items.map(it => {
            const tracked = inventoryEnabled && it.track_stock;
            const qty = it.stock_qty ?? 0;
            const low = tracked && qty <= (it.reorder_level ?? 0);
            return (
              <Card key={it.id}>
                <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 17 }}>{it.item_name}</strong>
                    {it.default_rate != null ? (
                      <span
                        className="badge badge-primary"
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => openEdit(it)}
                        title="Click to edit price"
                      >
                        {formatCurrency(it.default_rate)} ✏️
                      </span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(it)}
                        style={{ padding: '2px 8px', fontSize: 12 }}
                      >
                        + Set Price ✏️
                      </button>
                    )}
                    {tracked ? (
                      <span className={`badge ${low ? 'badge-danger' : 'badge-success'}`}>
                        {low ? '⚠️ ' : ''}In stock: {qty}
                      </span>
                    ) : null}
                  </div>
                  <div className="row gap-sm">
                    {tracked ? (
                      <Button title="Stock" variant="ghost" small onClick={() => openAdjust(it)} />
                    ) : null}
                    <Button title="Edit" variant="ghost" small onClick={() => openEdit(it)} />
                    <Button title="Delete" variant="danger" small onClick={() => remove(it)} />
                  </div>
                </div>
              </Card>
            );
          })}
          {hasMore ? (
            <div style={{ marginTop: 14 }}>
              <Button title="Load more" variant="ghost" block loading={loadingMore} onClick={loadMore} />
            </div>
          ) : null}
        </>
      )}

      {/* Add / edit item */}
      <Modal open={modalOpen} title={editing ? 'Edit item' : 'New item'} onClose={() => setModalOpen(false)}>
        <TextField
          label="Item name"
          value={nameInput}
          autoFocus
          onChange={e => setNameInput(e.target.value)}
          placeholder="e.g. Cement bag"
        />
        <TextField
          label="Default rate (optional)"
          value={rateInput}
          inputMode="decimal"
          onChange={e => setRateInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !inventoryEnabled && save()}
          placeholder="e.g. 350"
        />

        {inventoryEnabled ? (
          <>
            <label
              className="row gap-sm"
              style={{ margin: '4px 0 10px', cursor: 'pointer', fontWeight: 600 }}
            >
              <input
                type="checkbox"
                checked={trackInput}
                onChange={e => setTrackInput(e.target.checked)}
              />
              Track stock for this item
            </label>

            {trackInput ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <TextField
                  label={editing ? 'Add to stock now (optional)' : 'Opening stock'}
                  value={openingInput}
                  inputMode="decimal"
                  onChange={e => setOpeningInput(e.target.value)}
                  placeholder={editing ? 'e.g. 20' : 'e.g. 100'}
                />
                <TextField
                  label="Reorder level"
                  value={reorderInput}
                  inputMode="decimal"
                  onChange={e => setReorderInput(e.target.value)}
                  placeholder="e.g. 10"
                />
                <TextField
                  label="Cost price (optional)"
                  value={costInput}
                  inputMode="decimal"
                  onChange={e => setCostInput(e.target.value)}
                  placeholder="e.g. 250"
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div className="row gap-sm" style={{ marginTop: 8 }}>
          <Button title="Cancel" variant="ghost" block onClick={() => setModalOpen(false)} />
          <Button title="Save" block loading={saving} onClick={save} />
        </div>
      </Modal>

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

      {/* CSV bulk import */}
      <Modal open={importOpen} title="Import items from CSV" onClose={() => setImportOpen(false)}>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          One item per line, columns in this order (a header row is optional):
          <br />
          <code>name, rate, stock, reorder, cost</code>
          <br />
          {inventoryEnabled
            ? 'Rows with a stock/reorder/cost value are set to track stock automatically.'
            : 'Stock columns are ignored until an admin enables inventory.'}
        </p>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setCsvText(String(reader.result ?? ''));
            reader.readAsText(file);
          }}
          style={{ marginBottom: 10 }}
        />
        <textarea
          className="input"
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder={'Cement bag, 350, 100, 10, 250\nSteel rod, 500, 40, 5, 420'}
          rows={7}
          style={{ fontFamily: 'monospace', resize: 'vertical' }}
        />
        <div className="row gap-sm" style={{ marginTop: 8 }}>
          <Button title="Cancel" variant="ghost" block onClick={() => setImportOpen(false)} />
          <Button title="Import" block loading={importing} onClick={runImport} />
        </div>
      </Modal>
    </div>
  );

  function openAdjust(it: Item) {
    setAdjustItem(it);
    setAdjustDelta('');
    setAdjustReason('restock');
    setAdjustNote('');
  }
}
