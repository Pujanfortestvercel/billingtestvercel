// ---------------------------------------------------------------------------
// ADMIN SERVICE — only works for accounts whose profile.role = 'admin'
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Subscription } from '../types/models';
import type { Profile } from './profileService';
import { PLANS, type PlanKey } from './subscriptionService';

export type AdminUserRow = Profile & { subscription: Subscription | null };

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

export async function unfreezeUser(userId: string): Promise<void> {
  return setSubscriptionPlan(userId, 'trial');
}

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

export async function freezeUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'frozen', updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await supabase.from('stock_movements').delete().eq('user_id', userId);
  
  const { data: userBills } = await supabase.from('bills').select('id').eq('user_id', userId);
  if (userBills && userBills.length > 0) {
    const billIds = userBills.map(b => b.id);
    await supabase.from('bill_items').delete().in('bill_id', billIds);
  }
  
  await supabase.from('bills').delete().eq('user_id', userId);
  await supabase.from('items').delete().eq('user_id', userId);
  await supabase.from('customers').delete().eq('user_id', userId);
  await supabase.from('settings').delete().eq('user_id', userId);
  await supabase.from('subscriptions').delete().eq('user_id', userId);
  const { error: profErr } = await supabase.from('profiles').delete().eq('id', userId);

  if (profErr) {
    console.error('Profile delete error:', profErr);
  }

  try {
    await supabase.rpc('admin_delete_user', { target_user: userId });
  } catch (e) {
    console.warn('RPC admin_delete_user info:', e);
  }
}
