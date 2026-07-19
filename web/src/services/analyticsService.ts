// ---------------------------------------------------------------------------
// ANALYTICS SERVICE (web-only addition) — lightweight aggregates for the
// dashboard. Uses head-count queries (no rows transferred) for totals, and a
// small bounded fetch of recent bills for revenue + the activity feed.
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

async function headCount(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [customers, items, bills] = await Promise.all([
    headCount('customers'),
    headCount('items'),
    headCount('bills'),
  ]);

  // All bills for revenue math. Bills are the core dataset; for very large
  // accounts this could be swapped for a Postgres RPC sum() later.
  const { data, error } = await supabase
    .from('bills')
    .select('*')
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
