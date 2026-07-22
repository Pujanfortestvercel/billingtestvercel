// ---------------------------------------------------------------------------
// INVENTORY SERVICE — manual stock changes + low-stock lookups.
// Sales/returns are handled automatically by DB triggers on bill_items
// (migration 004); this service is for the things a user does by hand:
// receiving stock, correcting a count, setting opening stock.
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Item, StockMovement } from '../types/models';

// Manual reasons the client is allowed to record (a 'sale' can only come from
// a bill, never directly).
export type StockReason = 'restock' | 'adjustment' | 'return' | 'opening';

// Record a manual stock change. `change` is signed: +5 received, -2 correction.
// Goes through the adjust_stock RPC, which verifies ownership server-side and
// keeps items.stock_qty in sync via the ledger trigger.
export async function adjustStock(
  itemId: string,
  change: number,
  reason: StockReason,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('adjust_stock', {
    p_item_id: itemId,
    p_change: change,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

// Tracked items at or below their reorder level (lowest stock first). Powers
// the dashboard low-stock widget. PostgREST can't compare two columns, so we
// fetch tracked items ordered by stock and filter against reorder_level here.
export async function listLowStock(limit = 1000): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('track_stock', true)
    .order('stock_qty', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Item[]).filter(
    i => (i.stock_qty ?? 0) <= (i.reorder_level ?? 0),
  );
}

// Recent stock movements for one item (newest first) — for a history view.
export async function listMovements(
  itemId: string,
  limit = 50,
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StockMovement[];
}

// A movement joined with its item's name — for the account-wide history feed.
export type MovementWithItem = StockMovement & { item_name?: string };

export async function listRecentMovements(limit = 50): Promise<MovementWithItem[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, items(item_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(m => ({
    ...(m as StockMovement),
    item_name: m.items?.item_name,
  }));
}

// One row of the stock valuation report.
export type ValuationRow = {
  item_id: string;
  item_name: string;
  stock_qty: number;
  reorder_level: number;
  cost_price: number | null;
  value: number; // stock_qty * cost_price
  low: boolean; // at/below reorder level
};

export type InventorySummary = {
  rows: ValuationRow[];
  totalValue: number;
  trackedCount: number;
  lowCount: number;
};

// Every tracked item with its on-hand quantity and stock value. Powers the
// Inventory page (valuation table + counts).
export async function getInventorySummary(): Promise<InventorySummary> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('track_stock', true)
    .order('item_name', { ascending: true });
  if (error) throw new Error(error.message);

  const items = (data ?? []) as Item[];
  const rows: ValuationRow[] = items.map(i => {
    const qty = i.stock_qty ?? 0;
    const reorder = i.reorder_level ?? 0;
    const cost = i.cost_price ?? null;
    return {
      item_id: i.id,
      item_name: i.item_name,
      stock_qty: qty,
      reorder_level: reorder,
      cost_price: cost,
      value: qty * (cost ?? 0),
      low: qty <= reorder,
    };
  });
  return {
    rows,
    totalValue: rows.reduce((s, r) => s + r.value, 0),
    trackedCount: rows.length,
    lowCount: rows.filter(r => r.low).length,
  };
}
