// ---------------------------------------------------------------------------
// CUSTOMER SERVICE — read/write customers. RLS keeps each user's data private,
// so we never have to filter by user_id when reading: the database does it.
// (We DO set user_id when creating, because the security rule requires it.)
// ---------------------------------------------------------------------------
import { supabase, escapeLike } from '../lib/supabase';
import type { Customer } from '../types/models';

// All of this user's customers, alphabetical.
export async function listCustomers(): Promise<Customer[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', uid)
    .order('customer_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

// Paginated list for the Customers screen — loads a PAGE at a time so it stays
// fast with 10,000+ customers. Optional `search` filters by name CONTAINS.
export async function fetchCustomersPage(params: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<Customer[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  let query = supabase
    .from('customers')
    .select('*')
    .eq('user_id', uid)
    .order('customer_name', { ascending: true })
    .range(params.offset, params.offset + params.limit - 1);
  const s = params.search?.trim();
  if (s) query = query.ilike('customer_name', `%${escapeLike(s)}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

// Autocomplete: names that START WITH `query`, case-insensitive ("r" === "R").
export async function searchCustomers(
  query: string,
  limit = 8,
): Promise<Customer[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', uid)
    .ilike('customer_name', `${escapeLike(q)}%`) // case-insensitive prefix match
    .order('customer_name', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

export async function createCustomer(
  userId: string,
  name: string,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ user_id: userId, customer_name: name.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Customer;
}

export async function updateCustomerName(
  id: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ customer_name: name.trim() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setFrozen(id: string, isFrozen: boolean): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ is_frozen: isFrozen })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Find an existing customer by exact name (case-insensitive), or null. Used by
// billing to check whether a typed customer exists / is frozen BEFORE saving.
export async function findCustomerByName(name: string): Promise<Customer | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', uid)
    .ilike('customer_name', escapeLike(trimmed))
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? (data[0] as Customer) : null;
}

// Used by billing: reuse an existing customer (matched case-insensitively) or
// create a new one if the typed name doesn't exist yet.
export async function findOrCreateCustomer(
  userId: string,
  name: string,
): Promise<Customer> {
  const trimmed = name.trim();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .ilike('customer_name', escapeLike(trimmed)) // exact name, ignoring case
    .limit(1);
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data[0] as Customer;
  return createCustomer(userId, trimmed);
}
