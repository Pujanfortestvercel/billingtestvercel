// ---------------------------------------------------------------------------
// ADMIN SERVICE — only works for accounts whose profile.role = 'admin'
// (the database's admin RLS policies allow reading/updating ALL subscriptions).
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Subscription } from '../types/models';
import type { Profile } from './profileService';
import { PLANS, type PlanKey } from './subscriptionService';

export type AdminUserRow = Profile & { subscription: Subscription | null };

// Every registered user (profiles) joined with their subscription.
export async function listAllUsers(): Promise<AdminUserRow[]> {
  const [pRes, sRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('*'),
  ]);
  if (pRes.error) throw new Error(pRes.error.message);
  if (sRes.error) throw new Error(sRes.error.message);

  const subMap = new Map<string, Subscription>();
  (sRes.data ?? []).forEach((s: any) => subMap.set(s.user_id, s as Subscription));

  return (pRes.data ?? []).map((p: any) => ({
    ...(p as Profile),
    subscription: subMap.get(p.id) ?? null,
  }));
}

// UNFREEZE (approve) an account → start its 21-day trial now.
export async function unfreezeUser(userId: string): Promise<void> {
  return setSubscriptionPlan(userId, 'trial');
}

// Assign a plan to an account (trial / 1m / 3m / 6m / 1y / permanent). Sets the
// status and the end date so the app enforces expiry. Permanent has no end.
export async function setSubscriptionPlan(
  userId: string,
  planKey: PlanKey,
): Promise<void> {
  const plan = PLANS.find(p => p.key === planKey);
  if (!plan) throw new Error('Unknown plan');
  const now = new Date();
  const end =
    plan.days != null ? new Date(now.getTime() + plan.days * 86400000) : null;
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: plan.status,
      plan: plan.key,
      trial_start: now.toISOString(),
      trial_end: end ? end.toISOString() : null,
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// Turn the INVENTORY feature on/off for an account. Only admins can write
// subscriptions (RLS), so this is the single gate for the feature.
export async function setUserInventory(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ inventory_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// FREEZE (suspend) an account → block their access to the app.
export async function freezeUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'frozen', updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// PERMANENTLY DELETE an account and ALL its data. Calls the admin-only
// SECURITY DEFINER function admin_delete_user() (see supabase/migrations).
// Deleting the auth user cascades to profile/subscription/customers/items/bills.
export async function deleteUserAccount(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', {
    target_user: userId,
  });
  if (error) throw new Error(error.message);
}
