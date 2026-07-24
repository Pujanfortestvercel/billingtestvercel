-- ===========================================================================
-- BillingApp — Database schema, security (RLS), roles, and trial automation
-- ---------------------------------------------------------------------------
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → "New query" → paste ALL of this → Run.
-- This whole file is safe to run more than once.
-- ===========================================================================

-- Fast case-insensitive text search (autocomplete) even with 10,000+ rows.
create extension if not exists pg_trgm;

-- ===========================================================================
-- TABLES
-- ===========================================================================

-- 0) PROFILES — one per user. Holds their role: 'user' (a business owner who
--    does billing) or 'admin' (you, the app owner, who manages subscriptions).
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- 1) SUBSCRIPTIONS — one row per user. Tracks the free trial & subscription.
create table if not exists public.subscriptions (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  trial_start timestamptz not null default now(),
  trial_end   timestamptz not null default (now() + interval '21 days'),
  status      text        not null default 'frozen'
              check (status in ('frozen', 'trial', 'active', 'expired')),
  updated_at  timestamptz not null default now()
);

-- 2) CUSTOMERS — each belongs to ONE user (user_id). This is data isolation.
create table if not exists public.customers (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  customer_name text        not null,
  is_frozen     boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- 3) ITEMS — products the shop sells. Also isolated per user.
create table if not exists public.items (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  item_name    text        not null,
  default_rate numeric(12,2),
  created_at   timestamptz not null default now()
);

-- 4) BILLS — the header/summary of each generated bill.
create table if not exists public.bills (
  id               uuid          primary key default gen_random_uuid(),
  user_id          uuid          not null references auth.users(id) on delete cascade,
  customer_id      uuid          references public.customers(id) on delete set null,
  customer_name    text          not null,
  customer_phone   text,
  customer_address text,
  bill_number      text          not null,
  subtotal         numeric(12,2) not null default 0,
  discount_percent numeric(6,2)  not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  service_charge   numeric(12,2) not null default 0,
  tax_percent      numeric(6,2)  not null default 0,
  tax_amount       numeric(12,2) not null default 0,
  total_amount     numeric(12,2) not null default 0,
  notes            text,
  order_type       text,
  table_number     text,
  extra            jsonb         not null default '{}'::jsonb,
  created_at       timestamptz   not null default now()
);

-- 5) BILL_ITEMS — the line rows inside each bill.
create table if not exists public.bill_items (
  id          uuid          primary key default gen_random_uuid(),
  bill_id     uuid          not null references public.bills(id) on delete cascade,
  item_id     uuid          references public.items(id) on delete set null,
  item_name   text          not null,
  qty         numeric(12,2) not null,
  rate        numeric(12,2) not null,
  discount    numeric(6,2)  not null default 0,
  total       numeric(12,2) not null,
  batch_no    text,
  expiry_date date,
  meta        jsonb         not null default '{}'::jsonb
);

-- ===========================================================================
-- INDEXES (fast filtering by user + fast name search at large scale)
-- ===========================================================================
create index if not exists idx_customers_user      on public.customers(user_id);
create index if not exists idx_customers_name_trgm  on public.customers using gin (customer_name gin_trgm_ops);
create index if not exists idx_items_user           on public.items(user_id);
create index if not exists idx_items_name_trgm      on public.items using gin (item_name gin_trgm_ops);
create index if not exists idx_bills_user           on public.bills(user_id);
create index if not exists idx_bills_customer       on public.bills(customer_id);
create index if not exists idx_bill_items_bill      on public.bill_items(bill_id);

-- ===========================================================================
-- is_admin() — true if the given user is an admin. SECURITY DEFINER so it can
-- read profiles without tripping over the very RLS policies that call it.
-- ===========================================================================
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

-- ===========================================================================
-- ROW LEVEL SECURITY (RLS)
-- The database itself refuses rows that don't belong to the requester.
-- Admins get extra read/manage access to PROFILES and SUBSCRIPTIONS only —
-- never to anyone's customers/items/bills (that stays private to each user).
-- ===========================================================================
alter table public.profiles      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.customers     enable row level security;
alter table public.items         enable row level security;
alter table public.bills         enable row level security;
alter table public.bill_items    enable row level security;

-- PROFILES: read your own; admins can read everyone's. No client updates.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (id = auth.uid() or public.is_admin(auth.uid()));

-- IMPORTANT: clients must NOT be able to UPDATE their own profile, or a user
-- could set their own role to 'admin' and escalate privileges. The role is
-- changed only via the Supabase SQL editor (runs as superuser, bypasses RLS).
drop policy if exists "profiles update own" on public.profiles;

-- SUBSCRIPTIONS: full access to your own; admins can read & update all.
-- Customers may READ their own subscription, but NOT change it. Only the admin
-- (policies below) and the signup trigger write subscriptions — this stops a
-- customer from self-approving / extending their own trial.
drop policy if exists "own subscription" on public.subscriptions;
drop policy if exists "own subscription read" on public.subscriptions;
create policy "own subscription read" on public.subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "admin read subscriptions" on public.subscriptions;
create policy "admin read subscriptions" on public.subscriptions
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admin update subscriptions" on public.subscriptions;
create policy "admin update subscriptions" on public.subscriptions
  for update using (public.is_admin(auth.uid())) with check (true);

-- CUSTOMERS / ITEMS / BILLS: strictly your own (admins included — private data).
drop policy if exists "own customers" on public.customers;
create policy "own customers" on public.customers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own items" on public.items;
create policy "own items" on public.items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own bills" on public.bills;
create policy "own bills" on public.bills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- BILL_ITEMS: allowed only when the PARENT bill belongs to the current user.
drop policy if exists "own bill_items" on public.bill_items;
create policy "own bill_items" on public.bill_items
  for all using (
    exists (select 1 from public.bills b
            where b.id = bill_items.bill_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.bills b
            where b.id = bill_items.bill_id and b.user_id = auth.uid())
  );

-- ===========================================================================
-- ON SIGNUP: auto-create the profile (role 'user') AND a 21-day trial.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;

  -- New accounts start 'frozen'. The 21-day trial begins when the admin unfreezes.
  insert into public.subscriptions (user_id, trial_start, trial_end, status)
  values (new.id, now(), now() + interval '21 days', 'frozen')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- ADMIN: PERMANENTLY DELETE A USER ACCOUNT
-- ---------------------------------------------------------------------------
-- The app's anon key cannot delete an auth user (that needs elevated rights),
-- so we expose a SECURITY DEFINER function. It:
--   1) verifies the CALLER is an admin (so normal users can't call it),
--   2) refuses to delete an admin's own account,
--   3) deletes the row from auth.users — which CASCADES to the user's
--      profile, subscription, customers, items, bills and bill_items (all
--      tables reference auth.users(id) ON DELETE CASCADE). One delete, gone.
-- ===========================================================================
create or replace function public.admin_delete_user(target_user uuid)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can delete accounts';
  end if;
  if target_user = auth.uid() then
    raise exception 'You cannot delete your own admin account';
  end if;

  -- Explicitly delete user data from all tables to prevent orphans
  delete from public.stock_movements where user_id = target_user;
  delete from public.bill_items where bill_id in (select id from public.bills where user_id = target_user);
  delete from public.bills where user_id = target_user;
  delete from public.items where user_id = target_user;
  delete from public.customers where user_id = target_user;
  delete from public.settings where user_id = target_user;
  delete from public.subscriptions where user_id = target_user;
  delete from public.profiles where id = target_user;

  -- Delete auth user
  delete from auth.users where id = target_user;
end;
$$;

-- Only logged-in users may call it (the function itself enforces admin-only).
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ===========================================================================
-- STORE TYPES, PER-USER SETTINGS/PROFILE, AND RICHER BILLS (migration 002)
-- ===========================================================================
create table if not exists public.settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  store_type text not null default 'grocery'
             check (store_type in
               ('grocery','medical','restaurant','apparel','electronics','services')),
  shop_name  text,
  logo_url   text,
  phone      text,
  address    text,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.bills
  add column if not exists subtotal        numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists tax_percent     numeric(6,2)  not null default 0,
  add column if not exists tax_amount      numeric(12,2) not null default 0,
  add column if not exists extra           jsonb         not null default '{}'::jsonb;

alter table public.bill_items
  add column if not exists discount numeric(6,2) not null default 0,
  add column if not exists meta     jsonb        not null default '{}'::jsonb;

create index if not exists idx_bill_items_expiry
  on public.bill_items ((meta->>'expiry_date'));

-- ===========================================================================
-- SUBSCRIPTION PLANS (migration 003) — plan label + nullable end date
-- (NULL trial_end = permanent/unlimited).
-- ===========================================================================
alter table public.subscriptions add column if not exists plan text;
alter table public.subscriptions alter column trial_end drop not null;

-- ===========================================================================
-- INVENTORY (migration 004) — optional per-user stock tracking, admin-gated.
-- Full explanation lives in supabase/migrations/004_inventory.sql.
-- ===========================================================================
alter table public.subscriptions
  add column if not exists inventory_enabled boolean not null default false;

alter table public.items
  add column if not exists track_stock   boolean       not null default false,
  add column if not exists stock_qty     numeric(12,2) not null default 0,
  add column if not exists reorder_level numeric(12,2) not null default 0,
  add column if not exists cost_price    numeric(12,2);

alter table public.bill_items
  add column if not exists item_id uuid references public.items(id) on delete set null;
create index if not exists idx_bill_items_item on public.bill_items(item_id);

update public.bill_items bi
   set item_id = i.id
  from public.items i, public.bills b
 where bi.item_id is null
   and b.id = bi.bill_id
   and b.user_id = i.user_id
   and lower(i.item_name) = lower(bi.item_name);

create table if not exists public.stock_movements (
  id         uuid          primary key default gen_random_uuid(),
  user_id    uuid          not null references auth.users(id) on delete cascade,
  item_id    uuid          not null references public.items(id) on delete cascade,
  change     numeric(12,2) not null,
  reason     text          not null
             check (reason in ('sale','restock','adjustment','return','opening')),
  bill_id    uuid          references public.bills(id) on delete set null,
  note       text,
  created_at timestamptz   not null default now()
);
create index if not exists idx_stock_mov_user on public.stock_movements(user_id);
create index if not exists idx_stock_mov_item on public.stock_movements(item_id, created_at desc);

alter table public.stock_movements enable row level security;
drop policy if exists "own stock_movements" on public.stock_movements;
create policy "own stock_movements" on public.stock_movements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.items set stock_qty = stock_qty + new.change where id = new.item_id;
  elsif (tg_op = 'DELETE') then
    update public.items set stock_qty = stock_qty - old.change where id = old.item_id;
  elsif (tg_op = 'UPDATE') then
    update public.items set stock_qty = stock_qty - old.change + new.change where id = new.item_id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_apply_stock_movement on public.stock_movements;
create trigger trg_apply_stock_movement
  after insert or update or delete on public.stock_movements
  for each row execute function public.apply_stock_movement();

create or replace function public.bill_item_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_bill_owner uuid;
  v_item_owner uuid;
  v_track boolean;
begin
  if (tg_op = 'INSERT') then
    select user_id into v_bill_owner from public.bills where id = NEW.bill_id;
    if NEW.item_id is not null then
      select user_id, track_stock into v_item_owner, v_track from public.items where id = NEW.item_id;
      if v_bill_owner is not null and v_item_owner = v_bill_owner and coalesce(v_track, true) then
        insert into public.stock_movements (user_id, item_id, change, reason, bill_id)
        values (v_bill_owner, NEW.item_id, -NEW.qty, 'sale', NEW.bill_id);
      end if;
    end if;
  elsif (tg_op = 'DELETE') then
    select user_id into v_bill_owner from public.bills where id = OLD.bill_id;
    if OLD.item_id is not null then
      select user_id, track_stock into v_item_owner, v_track from public.items where id = OLD.item_id;
      if v_bill_owner is not null and v_item_owner = v_bill_owner and coalesce(v_track, true) then
        insert into public.stock_movements (user_id, item_id, change, reason, bill_id)
        values (v_bill_owner, OLD.item_id, OLD.qty, 'return', OLD.bill_id);
      end if;
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_bill_item_stock on public.bill_items;
create trigger trg_bill_item_stock
  after insert or delete on public.bill_items
  for each row execute function public.bill_item_stock();

create or replace function public.adjust_stock(
  p_item_id uuid, p_change numeric, p_reason text, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.items where id = p_item_id;
  if v_user is null then raise exception 'Item not found'; end if;
  if v_user <> auth.uid() then raise exception 'Not allowed'; end if;
  if p_reason not in ('restock','adjustment','return','opening') then
    raise exception 'Invalid reason';
  end if;
  insert into public.stock_movements (user_id, item_id, change, reason, note)
  values (v_user, p_item_id, p_change, p_reason, p_note);
end;
$$;
revoke all on function public.adjust_stock(uuid, numeric, text, text) from public, anon;
grant execute on function public.adjust_stock(uuid, numeric, text, text) to authenticated;

-- ATOMIC BILL TRANSACTIONS
create or replace function public.create_bill_transaction(
  p_user_id uuid, p_bill_number text, p_customer_name text, p_customer_phone text default null,
  p_customer_address text default null, p_subtotal numeric default 0, p_tax_percent numeric default 0,
  p_tax_amount numeric default 0, p_service_charge numeric default 0, p_discount_percent numeric default 0,
  p_discount_amount numeric default 0, p_total_amount numeric default 0, p_notes text default null,
  p_order_type text default null, p_table_number text default null, p_customer_id uuid default null,
  p_items jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_bill_id uuid; v_item jsonb;
begin
  if auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if p_customer_id is not null then
    if not exists (select 1 from public.customers where id = p_customer_id and user_id = p_user_id) then
      p_customer_id := null;
    end if;
  end if;
  insert into public.bills (
    user_id, bill_number, customer_name, customer_phone, customer_address,
    subtotal, tax_percent, tax_amount, service_charge, discount_percent,
    discount_amount, total_amount, notes, order_type, table_number, customer_id
  ) values (
    p_user_id, p_bill_number, p_customer_name, p_customer_phone, p_customer_address,
    p_subtotal, p_tax_percent, p_tax_amount, p_service_charge, p_discount_percent,
    p_discount_amount, p_total_amount, p_notes, p_order_type, p_table_number, p_customer_id
  ) returning id into v_bill_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.bill_items (
      bill_id, item_name, qty, rate, total, item_id, batch_no, expiry_date
    ) values (
      v_bill_id, v_item->>'item_name', coalesce((v_item->>'qty')::numeric, 0),
      coalesce((v_item->>'rate')::numeric, 0), coalesce((v_item->>'total')::numeric, 0),
      case when (v_item->>'item_id') is null or (v_item->>'item_id') = '' then null else (v_item->>'item_id')::uuid end,
      v_item->>'batch_no',
      case when (v_item->>'expiry_date') is null or (v_item->>'expiry_date') = '' then null else (v_item->>'expiry_date')::date end
    );
  end loop;
  return v_bill_id;
end;
$$;

create or replace function public.update_bill_transaction(
  p_bill_id uuid, p_user_id uuid, p_customer_name text, p_customer_phone text default null,
  p_customer_address text default null, p_subtotal numeric default 0, p_tax_percent numeric default 0,
  p_tax_amount numeric default 0, p_service_charge numeric default 0, p_discount_percent numeric default 0,
  p_discount_amount numeric default 0, p_total_amount numeric default 0, p_notes text default null,
  p_order_type text default null, p_table_number text default null, p_customer_id uuid default null,
  p_items jsonb default '[]'::jsonb
) returns void language plpgsql security definer set search_path = public, auth as $$
declare v_item jsonb;
begin
  if auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.bills where id = p_bill_id and user_id = p_user_id) then
    raise exception 'Bill not found';
  end if;
  if p_customer_id is not null then
    if not exists (select 1 from public.customers where id = p_customer_id and user_id = p_user_id) then
      p_customer_id := null;
    end if;
  end if;
  update public.bills set
    customer_name = p_customer_name, customer_phone = p_customer_phone, customer_address = p_customer_address,
    subtotal = p_subtotal, tax_percent = p_tax_percent, tax_amount = p_tax_amount,
    service_charge = p_service_charge, discount_percent = p_discount_percent,
    discount_amount = p_discount_amount, total_amount = p_total_amount, notes = p_notes,
    order_type = p_order_type, table_number = p_table_number, customer_id = p_customer_id
  where id = p_bill_id and user_id = p_user_id;

  delete from public.bill_items where bill_id = p_bill_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.bill_items (
      bill_id, item_name, qty, rate, total, item_id, batch_no, expiry_date
    ) values (
      p_bill_id, v_item->>'item_name', coalesce((v_item->>'qty')::numeric, 0),
      coalesce((v_item->>'rate')::numeric, 0), coalesce((v_item->>'total')::numeric, 0),
      case when (v_item->>'item_id') is null or (v_item->>'item_id') = '' then null else (v_item->>'item_id')::uuid end,
      v_item->>'batch_no',
      case when (v_item->>'expiry_date') is null or (v_item->>'expiry_date') = '' then null else (v_item->>'expiry_date')::date end
    );
  end loop;
end;
$$;

create or replace function public.delete_bill_transaction(
  p_bill_id uuid, p_user_id uuid
) returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.bills where id = p_bill_id and user_id = p_user_id) then
    raise exception 'Bill not found';
  end if;
  delete from public.bill_items where bill_id = p_bill_id;
  delete from public.bills where id = p_bill_id and user_id = p_user_id;
end;
$$;

grant execute on function public.create_bill_transaction to authenticated;
grant execute on function public.update_bill_transaction to authenticated;
grant execute on function public.delete_bill_transaction to authenticated;

-- HARDENING & MEDICAL PROTECTION
create unique index if not exists idx_bills_user_bill_number on public.bills(user_id, bill_number);

create or replace function public.check_medical_bill_deletion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_store_type text;
begin
  select store_type into v_store_type from public.settings where user_id = OLD.user_id;
  if v_store_type = 'medical' then
    raise exception 'Medical store bills cannot be deleted due to regulatory compliance requirements.';
  end if;
  return OLD;
end;
$$;

drop trigger if exists trg_prevent_medical_bill_delete on public.bills;
create trigger trg_prevent_medical_bill_delete
  before delete on public.bills
  for each row execute function public.check_medical_bill_deletion();

-- ===========================================================================
-- Done! To make an account an admin, sign up once in the app, then run:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ===========================================================================
