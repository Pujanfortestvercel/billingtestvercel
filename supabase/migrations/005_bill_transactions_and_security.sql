-- ===========================================================================
-- MIGRATION 005 — Atomic Bill RPC Transactions & Trigger Security Hardening
-- ---------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this → Run.
-- Safe to run more than once.
-- ===========================================================================

-- 1) ATOMIC CREATE BILL TRANSACTION -----------------------------------------
create or replace function public.create_bill_transaction(
  p_user_id uuid,
  p_bill_number text,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_address text default null,
  p_subtotal numeric default 0,
  p_tax_percent numeric default 0,
  p_tax_amount numeric default 0,
  p_service_charge numeric default 0,
  p_discount_percent numeric default 0,
  p_discount_amount numeric default 0,
  p_total_amount numeric default 0,
  p_notes text default null,
  p_order_type text default null,
  p_table_number text default null,
  p_customer_id uuid default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_bill_id uuid;
  v_item jsonb;
begin
  if auth.uid() <> p_user_id then
    raise exception 'Unauthorized bill creation';
  end if;

  -- Validate customer ownership if customer_id provided
  if p_customer_id is not null then
    if not exists (select 1 from public.customers where id = p_customer_id and user_id = p_user_id) then
      p_customer_id := null;
    end if;
  end if;

  -- Create bill header
  insert into public.bills (
    user_id, bill_number, customer_name, customer_phone, customer_address,
    subtotal, tax_percent, tax_amount, service_charge, discount_percent,
    discount_amount, total_amount, notes, order_type, table_number, customer_id
  ) values (
    p_user_id, p_bill_number, p_customer_name, p_customer_phone, p_customer_address,
    p_subtotal, p_tax_percent, p_tax_amount, p_service_charge, p_discount_percent,
    p_discount_amount, p_total_amount, p_notes, p_order_type, p_table_number, p_customer_id
  )
  returning id into v_bill_id;

  -- Create bill items atomically
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.bill_items (
      bill_id, item_name, qty, rate, total, item_id, batch_no, expiry_date
    ) values (
      v_bill_id,
      v_item->>'item_name',
      coalesce((v_item->>'qty')::numeric, 0),
      coalesce((v_item->>'rate')::numeric, 0),
      coalesce((v_item->>'total')::numeric, 0),
      case when (v_item->>'item_id') is null or (v_item->>'item_id') = '' then null else (v_item->>'item_id')::uuid end,
      v_item->>'batch_no',
      case when (v_item->>'expiry_date') is null or (v_item->>'expiry_date') = '' then null else (v_item->>'expiry_date')::date end
    );
  end loop;

  return v_bill_id;
end;
$$;

-- 2) ATOMIC UPDATE BILL TRANSACTION -----------------------------------------
create or replace function public.update_bill_transaction(
  p_bill_id uuid,
  p_user_id uuid,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_address text default null,
  p_subtotal numeric default 0,
  p_tax_percent numeric default 0,
  p_tax_amount numeric default 0,
  p_service_charge numeric default 0,
  p_discount_percent numeric default 0,
  p_discount_amount numeric default 0,
  p_total_amount numeric default 0,
  p_notes text default null,
  p_order_type text default null,
  p_table_number text default null,
  p_customer_id uuid default null,
  p_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_item jsonb;
begin
  if auth.uid() <> p_user_id then
    raise exception 'Unauthorized bill update';
  end if;

  if not exists (select 1 from public.bills where id = p_bill_id and user_id = p_user_id) then
    raise exception 'Bill not found or unauthorized';
  end if;

  -- Validate customer ownership if customer_id provided
  if p_customer_id is not null then
    if not exists (select 1 from public.customers where id = p_customer_id and user_id = p_user_id) then
      p_customer_id := null;
    end if;
  end if;

  -- Update bill header
  update public.bills set
    customer_name = p_customer_name,
    customer_phone = p_customer_phone,
    customer_address = p_customer_address,
    subtotal = p_subtotal,
    tax_percent = p_tax_percent,
    tax_amount = p_tax_amount,
    service_charge = p_service_charge,
    discount_percent = p_discount_percent,
    discount_amount = p_discount_amount,
    total_amount = p_total_amount,
    notes = p_notes,
    order_type = p_order_type,
    table_number = p_table_number,
    customer_id = p_customer_id
  where id = p_bill_id and user_id = p_user_id;

  -- Replace bill items atomically
  delete from public.bill_items where bill_id = p_bill_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.bill_items (
      bill_id, item_name, qty, rate, total, item_id, batch_no, expiry_date
    ) values (
      p_bill_id,
      v_item->>'item_name',
      coalesce((v_item->>'qty')::numeric, 0),
      coalesce((v_item->>'rate')::numeric, 0),
      coalesce((v_item->>'total')::numeric, 0),
      case when (v_item->>'item_id') is null or (v_item->>'item_id') = '' then null else (v_item->>'item_id')::uuid end,
      v_item->>'batch_no',
      case when (v_item->>'expiry_date') is null or (v_item->>'expiry_date') = '' then null else (v_item->>'expiry_date')::date end
    );
  end loop;
end;
$$;

-- 3) ATOMIC DELETE BILL TRANSACTION -----------------------------------------
create or replace function public.delete_bill_transaction(
  p_bill_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if auth.uid() <> p_user_id then
    raise exception 'Unauthorized bill deletion';
  end if;

  if not exists (select 1 from public.bills where id = p_bill_id and user_id = p_user_id) then
    raise exception 'Bill not found or unauthorized';
  end if;

  delete from public.bill_items where bill_id = p_bill_id;
  delete from public.bills where id = p_bill_id and user_id = p_user_id;
end;
$$;

-- 4) HARDEN STOCK TRIGGER CROSS-ACCOUNT SECURITY ----------------------------
create or replace function public.bill_item_stock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_bill_owner uuid;
  v_item_owner uuid;
  v_track boolean;
begin
  if TG_OP = 'INSERT' then
    select user_id into v_bill_owner from public.bills where id = NEW.bill_id;
    if NEW.item_id is not null then
      select user_id, track_stock into v_item_owner, v_track from public.items where id = NEW.item_id;
      -- Ensure item and bill belong to the exact same user before creating stock movement
      if v_bill_owner is not null and v_item_owner = v_bill_owner and coalesce(v_track, true) then
        insert into public.stock_movements (user_id, item_id, change, reason, bill_id)
        values (v_bill_owner, NEW.item_id, -NEW.qty, 'sale', NEW.bill_id);
      end if;
    end if;
  elsif TG_OP = 'DELETE' then
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

grant execute on function public.create_bill_transaction to authenticated;
grant execute on function public.update_bill_transaction to authenticated;
grant execute on function public.delete_bill_transaction to authenticated;
