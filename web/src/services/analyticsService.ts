// ---------------------------------------------------------------------------
// ANALYTICS SERVICE — lightweight aggregates for the dashboard.
// Strictly filtered by user_id for complete multi-tenant account isolation!
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Bill } from '../types/models';

export type DashboardStats = {
  customers: number;
  items: number;
  bills: number;
  revenueTotal: number;
  revenueThisMonth: number;
  recent: Bill[];
  last7: { label: string; total: number }[];
};

async function headCount(table: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return 0;
  return count ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    return {
      customers: 0,
      items: 0,
      bills: 0,
      revenueTotal: 0,
      revenueThisMonth: 0,
      recent: [],
      last7: [],
    };
  }

  const [customers, items, bills] = await Promise.all([
    headCount('customers', userId),
    headCount('items', userId),
    headCount('bills', userId),
  ]);

  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const all = (data ?? []) as Bill[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let revenueTotal = 0;
  let revenueThisMonth = 0;
  for (const b of all) {
    revenueTotal += b.total_amount;
    if (new Date(b.created_at).getTime() >= monthStart) {
      revenueThisMonth += b.total_amount;
    }
  }

  // Revenue for each of the last 7 days (oldest → newest).
  const last7: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const next = new Date(day.getTime() + 86400000);
    const total = all
      .filter(b => {
        const t = new Date(b.created_at).getTime();
        return t >= day.getTime() && t < next.getTime();
      })
      .reduce((s, b) => s + b.total_amount, 0);
    last7.push({
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      total,
    });
  }

  return {
    customers,
    items,
    bills,
    revenueTotal,
    revenueThisMonth,
    recent: all.slice(0, 5),
    last7,
  };
}
