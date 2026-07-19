-- ===========================================================================
-- MIGRATION 002 — Store types, per-user settings/profile, and richer bills
-- ---------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this → Run.
-- Safe to run more than once.
--
-- Adds:
--   • settings — one row per user: their store type + shop profile (name,
--     logo, phone, address). RLS keeps it private to each user.
--   • bills    — subtotal, bill-level discount, tax, and a flexible `extra`
--     jsonb (service charge, table no, order type, notes, store_type snapshot).
--   • bill_items — per-line discount % and a `meta` jsonb (batch no, expiry
--     date, HSN, size, serial no, warranty) so each store type stores its own
--     fields without a schema change per type.
-- ===========================================================================

-- 1) PER-USER SETTINGS / SHOP PROFILE -------------------------------------
create table if not exists public.settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  store_type text not null default 'grocery'
             check (store_type in
               ('grocery','medical','restaurant','apparel','electronics','services')),
  shop_name  text,
  logo_url   text,              -- small logo stored as a data URL
  phone      text,              -- shop keeper's number
  address    text,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) RICHER BILLS ----------------------------------------------------------
alter table public.bills
  add column if not exists subtotal        numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists tax_percent     numeric(6,2)  not null default 0,
  add column if not exists tax_amount      numeric(12,2) not null default 0,
  add column if not exists extra           jsonb         not null default '{}'::jsonb;

-- 3) RICHER BILL LINES -----------------------------------------------------
alter table public.bill_items
  add column if not exists discount numeric(6,2) not null default 0, -- per-line %
  add column if not exists meta     jsonb        not null default '{}'::jsonb;

-- Helpful index for medical expiry reminders (queries meta->>'expiry_date').
create index if not exists idx_bill_items_expiry
  on public.bill_items ((meta->>'expiry_date'));
