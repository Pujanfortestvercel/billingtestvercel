-- ===========================================================================
-- MIGRATION 008 — Public Storefront Catalog & Online Orders RLS Policies
-- ---------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this → Run.
--
-- Allows unauthenticated public buyers to view products and submit online orders.
-- ===========================================================================

-- 1. Allow public select on items for storefront
drop policy if exists "Items readable publicly for storefront" on public.items;
create policy "Items readable publicly for storefront"
  on public.items for select
  using (true);

-- 2. Allow public select on settings for storefront
drop policy if exists "Settings readable publicly for storefront" on public.settings;
create policy "Settings readable publicly for storefront"
  on public.settings for select
  using (true);

-- 3. Allow public insert on bills for online orders
drop policy if exists "Bills insertable publicly for storefront" on public.bills;
create policy "Bills insertable publicly for storefront"
  on public.bills for insert
  with check (true);

-- 4. Allow public insert on bill_items for online orders
drop policy if exists "Bill items insertable publicly for storefront" on public.bill_items;
create policy "Bill items insertable publicly for storefront"
  on public.bill_items for insert
  with check (true);

-- 5. Allow public select on bills for storefront
drop policy if exists "Bills readable publicly for storefront" on public.bills;
create policy "Bills readable publicly for storefront"
  on public.bills for select
  using (true);

-- 6. Allow public select on bill_items for storefront
drop policy if exists "Bill items readable publicly for storefront" on public.bill_items;
create policy "Bill items readable publicly for storefront"
  on public.bill_items for select
  using (true);
