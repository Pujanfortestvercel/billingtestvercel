// ---------------------------------------------------------------------------
// BILL SERVICE — create/update/list/delete bills and their line items.
// A "bill" is a header row (bills) + several line rows (bill_items).
// ---------------------------------------------------------------------------
import { supabase, escapeLike } from '../lib/supabase';
import type { Bill, BillItem } from '../types/models';
import { BILL_NUMBER_PREFIX } from '../config/constants';

// Shape of one line the billing screen sends us (no ids yet).
export type BillItemInput = {
  item_name: string;
  qty: number;
  rate: number;
  total: number;
  discount?: number; // per-line discount %
  meta?: Record<string, string>; // batch_no, expiry_date, hsn, size, serial…
  item_id?: string | null; // links the line to an item so stock can be adjusted
};

// Everything needed to save a bill.
export type BillInput = {
  customerId: string | null;
  customerName: string;
  billNumber: string;
  total: number;
  items: BillItemInput[];
  // Totals breakdown + per-store extras (migration 002).
  subtotal?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  extra?: Record<string, unknown>;
};

// A bill plus its lines, used by the History/Edit screens.
export type BillWithItems = Bill & { items: BillItem[] };

// Suggest the next bill number, e.g. "INV-1024". We take the MAX trailing
// number across the user's recent bills — not just the newest by date — so a
// manually-entered or out-of-order number can't make the sequence regress and
// collide. (For hard concurrency safety, add a UNIQUE(user_id, bill_number)
// constraint in the DB and retry on conflict.)
export async function getNextBillNumber(): Promise<string> {
  const { data, error } = await supabase
    .from('bills')
    .select('bill_number')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  let highest = 1000;
  for (const row of data ?? []) {
    const match = /(\d+)\s*$/.exec(row.bill_number ?? '');
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > highest) highest = n;
    }
  }
  return `${BILL_NUMBER_PREFIX}${highest + 1}`;
}

// All of the user's bills, newest first (capped for memory efficiency).
export async function listBills(limit = 1000): Promise<Bill[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Bill[];
}

// Paginated bills for the History screen (newest first). Optional `search`
// filters by customer name CONTAINS. Optional `fromDate` / `toDate` restrict
// bills to a date range (inclusive). Loads a page at a time for scale.
export async function fetchBillsPage(params: {
  search?: string;
  fromDate?: string;   // YYYY-MM-DD
  toDate?: string;     // YYYY-MM-DD
  limit: number;
  offset: number;
}): Promise<Bill[]> {
  let query = supabase
    .from('bills')
    .select('*')
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);
  const s = params.search?.trim();
  if (s) query = query.ilike('customer_name', `%${escapeLike(s)}%`);
  const isValidDate = (d?: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (isValidDate(params.fromDate)) query = query.gte('created_at', `${params.fromDate}T00:00:00`);
  if (isValidDate(params.toDate)) query = query.lte('created_at', `${params.toDate}T23:59:59`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Bill[];
}

// Bills whose customer name contains `query` (case-insensitive), newest first.
export async function searchBills(query: string): Promise<Bill[]> {
  const q = query.trim();
  if (!q) return listBills();
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .ilike('customer_name', `%${escapeLike(q)}%`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Bill[];
}

// The line items of one bill.
export async function getBillItems(billId: string): Promise<BillItem[]> {
  const { data, error } = await supabase
    .from('bill_items')
    .select('*')
    .eq('bill_id', billId);
  if (error) throw new Error(error.message);
  return (data ?? []) as BillItem[];
}

export async function getBillWithItems(billId: string): Promise<BillWithItems> {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .single();
  if (error) throw new Error(error.message);
  const items = await getBillItems(billId);
  return { ...(data as Bill), items };
}

// Create a new bill + its lines. If the lines fail to save, we remove the
// half-saved header so we never leave a broken bill behind.
export async function createBill(
  userId: string,
  input: BillInput,
): Promise<Bill> {
  if (!input.items || input.items.length === 0) {
    throw new Error('A bill must have at least one item.');
  }

  // Try atomic RPC transaction
  const { data: rpcBillId, error: rpcError } = await supabase.rpc('create_bill_transaction', {
    p_user_id: userId,
    p_bill_number: input.billNumber,
    p_customer_name: input.customerName,
    p_customer_phone: input.extra?.customer_phone ?? null,
    p_customer_address: input.extra?.customer_address ?? null,
    p_subtotal: input.subtotal ?? input.total,
    p_tax_percent: input.taxPercent ?? 0,
    p_tax_amount: input.taxAmount ?? 0,
    p_service_charge: input.extra?.service_charge ?? 0,
    p_discount_percent: input.extra?.discount_percent ?? 0,
    p_discount_amount: input.discountAmount ?? 0,
    p_total_amount: input.total,
    p_notes: input.extra?.notes ?? null,
    p_order_type: input.extra?.order_type ?? null,
    p_table_number: input.extra?.table_number ?? null,
    p_customer_id: input.customerId ?? null,
    p_items: input.items,
  });

  if (!rpcError && rpcBillId) {
    const { data: created, error: fetchErr } = await supabase
      .from('bills')
      .select('*')
      .eq('id', rpcBillId)
      .single();
    if (!fetchErr && created) return created as Bill;
  }

  // Fallback to client inserts
  const { data: bill, error } = await supabase
    .from('bills')
    .insert({
      user_id: userId,
      customer_id: input.customerId,
      customer_name: input.customerName,
      bill_number: input.billNumber,
      total_amount: input.total,
      subtotal: input.subtotal ?? input.total,
      discount_amount: input.discountAmount ?? 0,
      tax_percent: input.taxPercent ?? 0,
      tax_amount: input.taxAmount ?? 0,
      extra: input.extra ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const rows = input.items.map(it => ({ bill_id: bill.id, ...it }));
  const { error: itemsError } = await supabase.from('bill_items').insert(rows);
  if (itemsError) {
    const { error: undoError } = await supabase
      .from('bills')
      .delete()
      .eq('id', bill.id);
    if (undoError) {
      throw new Error(
        `${itemsError.message} (and cleanup failed: ${undoError.message})`,
      );
    }
    throw new Error(itemsError.message);
  }
  return bill as Bill;
}

// Update an existing bill: change the header, then replace ALL its lines.
export async function updateBill(
  billId: string,
  input: BillInput,
): Promise<void> {
  if (!input.items || input.items.length === 0) {
    throw new Error('A bill must have at least one item.');
  }

  // Get user_id of current bill
  const { data: currentBill } = await supabase.from('bills').select('user_id').eq('id', billId).single();
  if (currentBill?.user_id) {
    const { error: rpcError } = await supabase.rpc('update_bill_transaction', {
      p_bill_id: billId,
      p_user_id: currentBill.user_id,
      p_customer_name: input.customerName,
      p_customer_phone: input.extra?.customer_phone ?? null,
      p_customer_address: input.extra?.customer_address ?? null,
      p_subtotal: input.subtotal ?? input.total,
      p_tax_percent: input.taxPercent ?? 0,
      p_tax_amount: input.taxAmount ?? 0,
      p_service_charge: input.extra?.service_charge ?? 0,
      p_discount_percent: input.extra?.discount_percent ?? 0,
      p_discount_amount: input.discountAmount ?? 0,
      p_total_amount: input.total,
      p_notes: input.extra?.notes ?? null,
      p_order_type: input.extra?.order_type ?? null,
      p_table_number: input.extra?.table_number ?? null,
      p_customer_id: input.customerId ?? null,
      p_items: input.items,
    });
    if (!rpcError) return;
  }

  // Fallback to client updates
  const { error } = await supabase
    .from('bills')
    .update({
      customer_id: input.customerId,
      customer_name: input.customerName,
      bill_number: input.billNumber,
      total_amount: input.total,
      subtotal: input.subtotal ?? input.total,
      discount_amount: input.discountAmount ?? 0,
      tax_percent: input.taxPercent ?? 0,
      tax_amount: input.taxAmount ?? 0,
      extra: input.extra ?? {},
    })
    .eq('id', billId);
  if (error) throw new Error(error.message);

  const { data: oldRows, error: readError } = await supabase
    .from('bill_items')
    .select('*')
    .eq('bill_id', billId);
  if (readError) throw new Error(readError.message);

  const { error: delError } = await supabase
    .from('bill_items')
    .delete()
    .eq('bill_id', billId);
  if (delError) throw new Error(delError.message);

  const rows = input.items.map(it => ({ bill_id: billId, ...it }));
  const { error: insError } = await supabase.from('bill_items').insert(rows);
  if (insError) {
    if (oldRows && oldRows.length > 0) {
      await supabase.from('bill_items').insert(oldRows);
    }
    throw new Error(insError.message);
  }
}

// Delete one bill (its lines are removed automatically via the database's
// "on delete cascade" rule).
export async function deleteBill(billId: string): Promise<void> {
  const { data: currentBill } = await supabase.from('bills').select('user_id').eq('id', billId).single();
  if (currentBill?.user_id) {
    const { error: rpcError } = await supabase.rpc('delete_bill_transaction', {
      p_bill_id: billId,
      p_user_id: currentBill.user_id,
    });
    if (!rpcError) return;
  }
  const { error } = await supabase.from('bills').delete().eq('id', billId);
  if (error) throw new Error(error.message);
}

// Delete ALL of the user's bills.
export async function deleteAllBills(userId: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// EXPIRY REMINDERS (medical) — bill lines whose batch expiry is already past
// or coming up within `daysAhead` days, newest-expiring first. Powers the
// dashboard reminder widget.
// ---------------------------------------------------------------------------
export type ExpiringLine = {
  id: string;
  item_name: string;
  expiry_date: string;
  batch_no?: string;
  bill_number?: string;
  customer_name?: string;
};

export async function getExpiringBatches(daysAhead = 60): Promise<ExpiringLine[]> {
  const cutoff = new Date(Date.now() + daysAhead * 86400000)
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD; ISO date strings sort chronologically as text
  const { data, error } = await supabase
    .from('bill_items')
    .select('id, item_name, meta, bills(bill_number, customer_name)')
    .not('meta->>expiry_date', 'is', null)
    .lte('meta->>expiry_date', cutoff)
    .order('meta->>expiry_date', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    item_name: r.item_name,
    expiry_date: r.meta?.expiry_date,
    batch_no: r.meta?.batch_no,
    bill_number: r.bills?.bill_number,
    customer_name: r.bills?.customer_name,
  }));
}
