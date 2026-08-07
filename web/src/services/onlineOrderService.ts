// ---------------------------------------------------------------------------
// ONLINE ORDERS SERVICE
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Bill, BillItem, Settings } from '../types/models';

export type OnlineOrder = {
  id: string;
  order_number: string;
  user_id: string; // shopkeeper id
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  items: Array<{
    item_id: string;
    item_name: string;
    qty: number;
    rate: number;
    total: number;
  }>;
  total_amount: number;
  status: 'pending' | 'accepted' | 'completed';
  created_at: string;
};

// Create a new online order from public storefront
export async function createOnlineOrder(orderData: {
  userId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{
    item_id: string;
    item_name: string;
    qty: number;
    rate: number;
    total: number;
  }>;
  totalAmount: number;
}): Promise<OnlineOrder> {
  const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date().toISOString();

  // Try creating in bills table with extra flag online_order: true
  const { data: billRes, error: billErr } = await supabase
    .from('bills')
    .insert({
      user_id: orderData.userId,
      customer_name: orderData.customerName,
      bill_number: orderNumber,
      total_amount: orderData.totalAmount,
      created_at: now,
      extra: {
        is_online_order: true,
        order_status: 'pending',
        customer_phone: orderData.customerPhone || '',
        patient_address: orderData.customerAddress || '',
      },
    })
    .select()
    .single();

  const billId = billRes ? billRes.id : 'ORD_' + Date.now();

  // Insert bill items
  if (billRes) {
    const itemRows = orderData.items.map(it => ({
      bill_id: billId,
      item_id: it.item_id,
      item_name: it.item_name,
      qty: it.qty,
      rate: it.rate,
      total: it.total,
    }));
    await supabase.from('bill_items').insert(itemRows);
  }

  return {
    id: billId,
    order_number: orderNumber,
    user_id: orderData.userId,
    customer_name: orderData.customerName,
    customer_phone: orderData.customerPhone,
    customer_address: orderData.customerAddress,
    items: orderData.items,
    total_amount: orderData.totalAmount,
    status: 'pending',
    created_at: now,
  };
}

// Fetch shopkeeper's online orders
export async function fetchOnlineOrders(userId: string): Promise<OnlineOrder[]> {
  const { data: bills, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !bills) return [];

  const onlineBills = bills.filter(b => b.extra && (b.extra as any).is_online_order);
  if (onlineBills.length === 0) return [];

  const billIds = onlineBills.map(b => b.id);
  const { data: billItems } = await supabase
    .from('bill_items')
    .select('*')
    .in('bill_id', billIds);

  const itemsMap: Record<string, any[]> = {};
  if (billItems) {
    for (const it of billItems) {
      if (!itemsMap[it.bill_id]) itemsMap[it.bill_id] = [];
      itemsMap[it.bill_id].push({
        item_id: it.item_id || '',
        item_name: it.item_name,
        qty: it.qty,
        rate: it.rate,
        total: it.total,
      });
    }
  }

  return onlineBills.map(b => ({
    id: b.id,
    order_number: b.bill_number,
    user_id: b.user_id,
    customer_name: b.customer_name,
    customer_phone: (b.extra as any)?.customer_phone || '',
    customer_address: (b.extra as any)?.patient_address || '',
    items: itemsMap[b.id] || [],
    total_amount: b.total_amount,
    status: (b.extra as any)?.order_status || 'pending',
    created_at: b.created_at,
  }));
}

// Update order status
export async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'accepted' | 'completed',
): Promise<void> {
  const { data: bill } = await supabase
    .from('bills')
    .select('extra')
    .eq('id', orderId)
    .single();

  const currentExtra = (bill?.extra as object) || {};
  await supabase
    .from('bills')
    .update({
      extra: { ...currentExtra, order_status: status },
    })
    .eq('id', orderId);
}
