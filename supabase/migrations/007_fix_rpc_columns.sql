-- ===========================================================================
-- MIGRATION 007: Add explicit columns to bills and bill_items for RPC compatibility
-- ===========================================================================

-- 1) Add missing columns to public.bills
alter table public.bills
  add column if not exists customer_phone     text,
  add column if not exists customer_address   text,
  add column if not exists service_charge     numeric(12,2) not null default 0,
  add column if not exists discount_percent   numeric(6,2)  not null default 0,
  add column if not exists notes              text,
  add column if not exists order_type         text,
  add column if not exists table_number       text;

-- 2) Add missing columns to public.bill_items
alter table public.bill_items
  add column if not exists batch_no    text,
  add column if not exists expiry_date date;

-- 3) Ensure indexes exist
create index if not exists idx_bill_items_expiry_col on public.bill_items(expiry_date);
