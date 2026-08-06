// ---------------------------------------------------------------------------
// AUTOMATED BANK SMS PAYMENT VERIFICATION SERVICE
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { PlanKey } from './subscriptionService';

export type PendingOrder = {
  orderRef: string;
  userId: string;
  planKey: PlanKey;
  amount: number;
  createdAt: number;
};

// Map of plan durations in days
const PLAN_DAYS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

// Generate a random 4-digit unique Order Ref code (e.g. "4921")
export function generateOrderRef(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Create a pending payment order in Supabase
export async function createPendingOrder(planKey: PlanKey, amount: number): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const orderRef = generateOrderRef();
  const userId = userData.user.id;

  // Insert into stock_movements as a pending subscription record
  await supabase.from('stock_movements').insert({
    item_id: planKey,
    user_id: userId,
    change: amount,
    reason: 'opening',
    note: `PENDING_ORDER:${orderRef}:${planKey}:${amount}`,
  });

  return orderRef;
}

// Check if subscription was verified by Bank SMS
export async function checkOrderVerified(orderRef: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, plan, updated_at')
    .eq('user_id', userData.user.id)
    .single();

  if (sub && sub.status === 'active') {
    return true;
  }
  return false;
}

// Process incoming Bank SMS Webhook payload (called by SMS Forwarder App on phone)
export async function processBankSmsWebhook(smsText: string): Promise<{ success: boolean; message: string }> {
  try {
    const text = smsText.toUpperCase();

    // Check if SMS indicates money credited
    if (!text.includes('CREDITED') && !text.includes('RECEIVED') && !text.includes('DEPOSITED')) {
      return { success: false, message: 'SMS is not a credit notification.' };
    }

    // Extract amount from SMS (e.g. "RS. 800.00" or "INR 2400" or "800.00 CREDITED")
    const amountMatch = text.match(/(?:RS|INR|₹)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i) || text.match(/([0-9,]+(?:\.[0-9]{2})?)\s*(?:RS|INR|₹|CREDITED)/i);
    if (!amountMatch) {
      return { success: false, message: 'Could not extract payment amount from SMS.' };
    }

    const parsedAmount = parseFloat(amountMatch[1].replace(/,/g, ''));

    // Fetch recent pending orders from database
    const { data: pendingRows } = await supabase
      .from('stock_movements')
      .select('*')
      .like('note', 'PENDING_ORDER:%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!pendingRows || pendingRows.length === 0) {
      return { success: false, message: 'No pending orders found.' };
    }

    // Match order by Ref code or Amount
    let matchedRow = pendingRows.find(row => {
      const parts = (row.note || '').split(':'); // PENDING_ORDER:Ref:planKey:amount
      const ref = parts[1];
      const amt = parseFloat(parts[3] || '0');
      return (text.includes(ref) || amt === parsedAmount) && (row.change === parsedAmount || amt === parsedAmount);
    });

    if (!matchedRow) {
      return { success: false, message: 'No matching order for amount Rs. ' + parsedAmount };
    }

    const parts = (matchedRow.note || '').split(':');
    const userId = matchedRow.user_id;
    const planKey = parts[2] as PlanKey;
    const days = PLAN_DAYS[planKey] || 30;

    const now = new Date();
    const endDate = new Date(now.getTime() + days * 86400000);

    // Activate User Subscription in Supabase!
    await supabase.from('subscriptions').upsert({
      user_id: userId,
      status: 'active',
      plan: planKey,
      trial_start: now.toISOString(),
      trial_end: endDate.toISOString(),
      inventory_enabled: true,
      updated_at: now.toISOString(),
    });

    // Update pending order note to COMPLETED
    await supabase.from('stock_movements').update({
      note: `COMPLETED_ORDER:${parts[1]}:${planKey}:${parsedAmount}`,
    }).eq('id', matchedRow.id);

    return { success: true, message: `Subscription activated for plan ${planKey} (Amount: Rs. ${parsedAmount})` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error processing SMS webhook' };
  }
}
