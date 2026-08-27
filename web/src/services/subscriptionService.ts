// ---------------------------------------------------------------------------
// SUBSCRIPTION SERVICE — the 21-day trial & subscription logic.
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Subscription } from '../types/models';

export type SubStatus = 'frozen' | 'trial' | 'active' | 'expired';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// The plans an admin can assign. `days: null` means permanent / unlimited.
export type PlanKey = 'trial' | '1m' | '3m' | '6m' | '1y' | 'permanent';

export const PLANS: {
  key: PlanKey;
  label: string;
  days: number | null;
  status: 'trial' | 'active';
  price: number;
  popular?: boolean;
  adminOnly?: boolean;
}[] = [
  { key: 'trial', label: '21-Day Free Trial', days: 21, status: 'trial', price: 0 },
  { key: '1m', label: '1 Month Plan', days: 30, status: 'active', price: 800 },
  { key: '3m', label: '3 Months Plan', days: 90, status: 'active', price: 2100 },
  { key: '6m', label: '6 Months Plan', days: 180, status: 'active', price: 3900 },
  { key: '1y', label: '1 Year Plan', days: 365, status: 'active', price: 6900, popular: true },
  { key: 'permanent', label: 'Permanent Plan', days: null, status: 'active', price: 0, adminOnly: true },
];

export function planLabel(key: string | null | undefined): string {
  return PLANS.find(p => p.key === key)?.label ?? '—';
}

// Read the current user's subscription row (created automatically on signup).
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Subscription) ?? null;
}

// Work out the REAL status right now from the dates (don't just trust the
// stored text, since a trial can quietly expire as time passes).
export function computeStatus(sub: Subscription | null): {
  status: SubStatus;
  daysLeft: number; // -1 means unlimited (permanent)
} {
  if (!sub) return { status: 'expired', daysLeft: 0 };
  // Frozen by the admin (or not yet approved) — app access is blocked.
  if (sub.status === 'frozen') return { status: 'frozen', daysLeft: 0 };

  // Permanent / unlimited: an active plan with no end date.
  if (sub.status === 'active' && !sub.trial_end) {
    return { status: 'active', daysLeft: -1 };
  }

  // No end date but not a permanent active plan → treat as expired.
  if (!sub.trial_end) return { status: 'expired', daysLeft: 0 };

  // Time-limited: trial OR a paid plan with an end date. Compute from the date
  // (don't just trust the stored text — a plan can quietly expire over time).
  const endMs = new Date(sub.trial_end).getTime();
  // An unparseable end date must not silently grant access (NaN comparisons are
  // always false, which would otherwise skip the expiry check below).
  if (!Number.isFinite(endMs)) return { status: 'expired', daysLeft: 0 };
  const msLeft = endMs - Date.now();
  if (msLeft <= 0) return { status: 'expired', daysLeft: 0 };
  const daysLeft = Math.max(0, Math.round(msLeft / MS_PER_DAY));
  // Keep the trial vs paid label so the UI can say "trial" or "subscribed".
  return { status: sub.status === 'active' ? 'active' : 'trial', daysLeft };
}

// Can the user use paid features (billing, etc.) right now?
export function isAppUsable(sub: Subscription | null): boolean {
  const { status } = computeStatus(sub);
  return status === 'trial' || status === 'active';
}

// Mark the subscription active (used later when you add real payments).
export async function activateSubscription(userId: string): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// FREE SUBSCRIPTION PAYMENTS — 1-tap request & Admin 1-click approval
// ---------------------------------------------------------------------------

export async function submitSubscriptionPayment(
  userId: string,
  userEmail: string,
  planKey: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase.from('subscription_payments').insert({
    user_id: userId,
    user_email: userEmail,
    plan_key: planKey,
    amount: amount,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function getUserPendingPayment(userId: string) {
  try {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getPendingSubscriptionRequests() {
  try {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function approveSubscriptionRequest(
  paymentId: string,
  userId: string,
  planKey: string,
): Promise<void> {
  const planObj = PLANS.find(p => p.key === planKey);
  const days = planObj?.days ?? null;

  let trialEndIso: string | null = null;
  if (days !== null) {
    trialEndIso = new Date(Date.now() + days * 86400000).toISOString();
  }

  // 1. Activate subscription table row
  const { error: subErr } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      plan: planKey,
      trial_end: trialEndIso,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (subErr) throw new Error(subErr.message);

  // 2. Clear payment requests for this user so pending status disappears completely
  try {
    await supabase.from('subscription_payments').delete().eq('user_id', userId);
  } catch {
    // Ignore if table RLS restricts delete
  }
}

export async function rejectSubscriptionRequest(paymentId: string): Promise<void> {
  try {
    await supabase.from('subscription_payments').delete().eq('id', paymentId);
  } catch {
    await supabase.from('subscription_payments').update({ status: 'rejected' }).eq('id', paymentId);
  }
}
