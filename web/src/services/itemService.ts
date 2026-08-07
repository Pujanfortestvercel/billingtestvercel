// ---------------------------------------------------------------------------
// ITEM SERVICE — read/write the user's products (used for item autocomplete).
// Mirrors the customer service.
// ---------------------------------------------------------------------------
import { supabase, escapeLike } from '../lib/supabase';
import type { Item } from '../types/models';

export async function listItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('item_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
}

export async function getItemCount(): Promise<number> {
  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}

// Paginated list for the Items screen — loads a PAGE at a time (scales to
// thousands). Optional `search` filters by name CONTAINS, case-insensitive.
export async function fetchItemsPage(params: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<Item[]> {
  let query = supabase
    .from('items')
    .select('*')
    .order('item_name', { ascending: true })
    .range(params.offset, params.offset + params.limit - 1);
  const s = params.search?.trim();
  if (s) query = query.ilike('item_name', `%${escapeLike(s)}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
}

// Autocomplete: items that START WITH `query`, case-insensitive.
export async function searchItems(query: string, limit = 8): Promise<Item[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .ilike('item_name', `${escapeLike(q)}%`)
    .order('item_name', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
}

// Optional inventory attributes settable when creating/editing an item.
export type ItemStockFields = {
  track_stock?: boolean;
  reorder_level?: number;
  cost_price?: number | null;
};

export async function createItem(
  userId: string,
  name: string,
  defaultRate: number | null = null,
  stock?: ItemStockFields,
): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      user_id: userId,
      item_name: name.trim(),
      default_rate: defaultRate,
      ...(stock ?? {}),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Item;
}

export async function updateItem(
  id: string,
  fields: {
    item_name?: string;
    default_rate?: number | null;
  } & ItemStockFields,
): Promise<void> {
  const { error } = await supabase.from('items').update(fields).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Billing helper: reuse an existing item or create it if new.
export async function findOrCreateItem(
  userId: string,
  name: string,
  defaultRate: number | null = null,
): Promise<Item> {
  const trimmed = name.trim();
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .ilike('item_name', escapeLike(trimmed))
    .limit(1);
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data[0] as Item;
  return createItem(userId, trimmed, defaultRate);
}
