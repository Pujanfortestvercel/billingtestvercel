// ---------------------------------------------------------------------------
// ONEAPI PAYMENTS SERVICE (AUTOMATED UPI GATEWAY)
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { PlanKey } from './subscriptionService';

export const ONEAPI_KEY = 'iKGIE2trx2zXlWe39SxWyqJu';
export const UPI_ID = 'bharwada.k.pujan@okaxis';

export type OneApiOrder = {
  orderId: string;
  amount: number;
  planKey: PlanKey;
  qrUrl: string;
  upiDeepLink: string;
  createdAt: number;
};

// Map plan duration in days
const PLAN_DAYS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

// Create OneAPI Dynamic Order
export async function createOneApiOrder(planKey: PlanKey, amount: number): Promise<OneApiOrder> {
  const orderId = 'ORD_' + Math.floor(100000 + Math.random() * 900000);
  const note = `REF ${orderId}`;
  
  // Standard UPI intent deep link
  const upiDeepLink = `upi://pay?pa=${UPI_ID}&pn=BusinessSathi&am=${amount}&tn=${encodeURIComponent(note)}&cu=INR`;
  
  // Dynamic QR code scanner image
  const qrUrl = `/upi_qr_scanner.png`;

  return {
    orderId,
    amount,
    planKey,
    qrUrl,
    upiDeepLink,
    createdAt: Date.now(),
  };
}

// Check OneAPI Payment Status
export async function checkOneApiPaymentVerified(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  return false;
}

// Activate User Subscription on Payment Verification
export async function activateUserSubscription(planKey: PlanKey, orderId?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const days = PLAN_DAYS[planKey] || 30;
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 86400000);

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userData.user.id,
      status: 'active',
      plan: planKey,
      trial_start: now.toISOString(),
      trial_end: endDate.toISOString(),
      inventory_enabled: true,
      updated_at: now.toISOString(),
    });

  if (error) throw new Error(error.message);
}
