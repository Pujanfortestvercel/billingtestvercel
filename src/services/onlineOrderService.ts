// ---------------------------------------------------------------------------
// ONLINE ORDERS SERVICE (Mobile App Sync)
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';

export type OnlineOrder = {
  id: string;
  order_number: string;
  user_id: string;
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
  completed_at?: string;
  created_at: string;
};

// Collision-safe order number using timestamp + random suffix
function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

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
  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  const formattedItems = orderData.items.map(it => ({
    item_id: it.item_id || null,
    item_name: it.item_name,
    qty: Number(it.qty) || 1,
    rate: Number(it.rate) || 0,
    total: Number(it.total) || (Number(it.rate) || 0) * (Number(it.qty) || 1),
  }));

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
        order_items: formattedItems,
      },
    })
    .select()
    .single();

  if (billErr) {
    throw new Error('Database Error: ' + billErr.message);
  }

  const billId = billRes.id;

  if (formattedItems.length > 0) {
    const itemRows = formattedItems.map(it => ({
      bill_id: billId,
      item_id: it.item_id,
      item_name: it.item_name,
      qty: it.qty,
      rate: it.rate,
      total: it.total,
      discount: 0,
    }));

    const { error: itemErr } = await supabase.from('bill_items').insert(itemRows);
    if (itemErr) {
      console.error('Warning: bill_items insert error:', itemErr);
    }
  }

  return {
    id: billId,
    order_number: orderNumber,
    user_id: orderData.userId,
    customer_name: orderData.customerName,
    customer_phone: orderData.customerPhone,
    customer_address: orderData.customerAddress,
    items: formattedItems as any,
    total_amount: orderData.totalAmount,
    status: 'pending',
    created_at: now,
  };
}

// Delete an online order permanently from DB
export async function deleteOnlineOrder(orderId: string): Promise<void> {
  try {
    await supabase.from('bill_items').delete().eq('bill_id', orderId);
    await supabase.from('bills').delete().eq('id', orderId);
  } catch (e) {
    console.error('Error deleting completed online order:', e);
  }
}

// Fetch shopkeeper's online orders (Auto-deletes orders completed > 5 mins ago)
export async function fetchOnlineOrders(userId: string): Promise<OnlineOrder[]> {
  const { data: bills, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .not('extra->is_online_order', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !bills) return [];

  const onlineBills = bills.filter(b => b.extra && (b.extra as any).is_online_order);
  if (onlineBills.length === 0) return [];

  const nowMs = Date.now();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const expiredIds: string[] = [];

  const activeBills = onlineBills.filter(b => {
    const extra = (b.extra as any) || {};
    if (extra.order_status === 'completed' && extra.completed_at) {
      const completedMs = new Date(extra.completed_at).getTime();
      if (nowMs - completedMs >= FIVE_MINUTES_MS) {
        expiredIds.push(b.id);
        return false;
      }
    }
    return true;
  });

  // Purge expired orders with proper await
  if (expiredIds.length > 0) {
    await Promise.allSettled(expiredIds.map(id => deleteOnlineOrder(id)));
  }

  if (activeBills.length === 0) return [];

  const billIds = activeBills.map(b => b.id);
  const { data: billItems } = await supabase
    .from('bill_items')
    .select('*')
    .in('bill_id', billIds);

  const itemsMap: Record<string, any[]> = {};
  if (billItems && billItems.length > 0) {
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

  return activeBills.map(b => {
    const extra = (b.extra as any) || {};
    const resolvedItems = itemsMap[b.id] && itemsMap[b.id].length > 0
      ? itemsMap[b.id]
      : (extra.order_items || []);

    return {
      id: b.id,
      order_number: b.bill_number,
      user_id: b.user_id,
      customer_name: b.customer_name,
      customer_phone: extra.customer_phone || '',
      customer_address: extra.patient_address || '',
      items: resolvedItems,
      total_amount: b.total_amount,
      status: extra.order_status || 'pending',
      completed_at: extra.completed_at,
      created_at: b.created_at,
    };
  });
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
  const updatedExtra: any = {
    ...currentExtra,
    order_status: status,
  };

  if (status === 'completed' && !updatedExtra.completed_at) {
    updatedExtra.completed_at = new Date().toISOString();
  }

  await supabase
    .from('bills')
    .update({ extra: updatedExtra })
    .eq('id', orderId);
}

// Deduct inventory stock for each item in an online order
export async function deductInventoryForOrder(
  items: Array<{ item_id: string; qty: number }>,
): Promise<void> {
  const results = await Promise.allSettled(
    items
      .filter(it => it.item_id)
      .map(async it => {
        const { data: item } = await supabase
          .from('items')
          .select('stock_qty, track_stock')
          .eq('id', it.item_id)
          .single();

        if (item) {
          const currentStock = item.stock_qty ?? 0;
          const newStock = Math.max(0, currentStock - it.qty);
          await supabase
            .from('items')
            .update({ stock_qty: newStock })
            .eq('id', it.item_id);

          if (item.track_stock) {
            const { data: itemFull } = await supabase
              .from('items')
              .select('user_id')
              .eq('id', it.item_id)
              .single();

            if (itemFull?.user_id) {
              await supabase.from('stock_movements').insert({
                item_id: it.item_id,
                user_id: itemFull.user_id,
                change: -it.qty,
                reason: 'sale',
                note: 'Online order stock deduction',
              });
            }
          }
        }
      }),
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn(`${failures.length} inventory deductions failed`);
  }
}

// Accept order AND deduct inventory in one call
export async function acceptAndDeductInventory(
  orderId: string,
  items: Array<{ item_id: string; qty: number }>,
): Promise<void> {
  await updateOrderStatus(orderId, 'accepted');
  await deductInventoryForOrder(items);
}
