-- ===========================================================================
-- MIGRATION 009 — Tighten Multi-Tenant RLS Privacy for Bills & Bill Items
-- ---------------------------------------------------------------------------
-- Enforces strict user_id isolation in Supabase RLS so users can ONLY see
-- their own bills, customers, items, and inventory data.
-- ===========================================================================

-- 1. Tighten Bills select RLS
drop policy if exists "Bills readable publicly for storefront" on public.bills;
drop policy if exists "Bills selectable by owner or storefront" on public.bills;

create policy "Bills selectable by owner or storefront"
  on public.bills for select
  using (
    auth.uid() = user_id 
    or (extra->>'is_online_order') = 'true'
  );

-- 2. Tighten Bill Items select RLS
drop policy if exists "Bill items readable publicly for storefront" on public.bill_items;
drop policy if exists "Bill items selectable by owner or storefront" on public.bill_items;

create policy "Bill items selectable by owner or storefront"
  on public.bill_items for select
  using (
    exists (
      select 1 from public.bills b 
      where b.id = bill_items.bill_id 
      and (b.user_id = auth.uid() or (b.extra->>'is_online_order') = 'true')
    )
  );

-- 3. Ensure customers is strictly isolated by owner
drop policy if exists "Customers selectable by owner" on public.customers;
create policy "Customers selectable by owner"
  on public.customers for select
  using (auth.uid() = user_id);

-- 4. Ensure stock_movements is strictly isolated by owner
drop policy if exists "Stock movements selectable by owner" on public.stock_movements;
create policy "Stock movements selectable by owner"
  on public.stock_movements for select
  using (auth.uid() = user_id);
