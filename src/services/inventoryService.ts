// ---------------------------------------------------------------------------
// INVENTORY SERVICE — manual stock changes + low-stock lookups.
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Item, StockMovement } from '../types/models';

export type StockReason = 'restock' | 'adjustment' | 'return' | 'opening';

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

export async function listLowStock(limit = 1000): Promise<Item[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', uid)
    .eq('track_stock', true)
    .order('stock_qty', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Item[]).filter(
    i => (i.stock_qty ?? 0) <= (i.reorder_level ?? 0),
  );
}

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

export type MovementWithItem = StockMovement & { item_name?: string };

export async function listRecentMovements(limit = 50): Promise<MovementWithItem[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, items(item_name)')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(m => ({
    ...(m as StockMovement),
    item_name: m.items?.item_name,
  }));
}

export type ValuationRow = {
  item_id: string;
  item_name: string;
  stock_qty: number;
  reorder_level: number;
  cost_price: number | null;
  value: number;
  low: boolean;
};

export type InventorySummary = {
  rows: ValuationRow[];
  totalValue: number;
  trackedCount: number;
  lowCount: number;
};

export async function getInventorySummary(): Promise<InventorySummary> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;

  if (!uid) {
    return { rows: [], totalValue: 0, trackedCount: 0, lowCount: 0 };
  }

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', uid)
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
