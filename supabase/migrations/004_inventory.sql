-- ===========================================================================
-- INVENTORY (migration 004) — optional per-user stock tracking.
-- ---------------------------------------------------------------------------
-- WHAT THIS ADDS:
--   • A feature flag on subscriptions (`inventory_enabled`) that ONLY the admin
--     can turn on (users can read it, not change it — same as their plan).
--   • Stock fields on items (track_stock, stock_qty cache, reorder_level, cost).
--   • A link from bill lines to items (bill_items.item_id) so a sale can be
--     attributed to a product.
--   • An append-only ledger (stock_movements) that is the SOURCE OF TRUTH.
--     items.stock_qty is just a cache kept in sync by a trigger.
--   • Triggers so your EXISTING billing flow adjusts stock automatically:
--       - inserting a bill line for a tracked item  → 'sale'   (stock ↓)
--       - deleting a bill line (edit or delete bill) → 'return' (stock ↑)
--   • adjust_stock() RPC for manual stock-in / corrections / opening stock.
--
-- Safe to run more than once. Run AFTER schema.sql / 002 / 003.
-- ===========================================================================

-- 1) ADMIN-CONTROLLED FEATURE FLAG -----------------------------------------
-- Lives on subscriptions because the RLS there already lets admins UPDATE and
-- users only SELECT — so a user cannot enable inventory for themselves.
alter table public.subscriptions
  add column if not exists inventory_enabled boolean not null default false;

-- 2) STOCK FIELDS ON ITEMS --------------------------------------------------
alter table public.items
  add column if not exists track_stock   boolean       not null default false,
  add column if not exists stock_qty     numeric(12,2) not null default 0, -- cached
  add column if not exists reorder_level numeric(12,2) not null default 0,
  add column if not exists cost_price    numeric(12,2);                    -- for valuation

-- 3) LINK BILL LINES TO ITEMS ----------------------------------------------
alter table public.bill_items
  add column if not exists item_id uuid references public.items(id) on delete set null;
create index if not exists idx_bill_items_item on public.bill_items(item_id);

-- Best-effort backfill for existing lines (name match within the same owner).
-- Only sets the link; it does NOT retro-create stock movements.
update public.bill_items bi
   set item_id = i.id
  from public.items i
  join public.bills b on b.id = bi.bill_id
 where bi.item_id is null
   and b.user_id = i.user_id
   and lower(i.item_name) = lower(bi.item_name);

-- 4) THE LEDGER -------------------------------------------------------------
create table if not exists public.stock_movements (
  id         uuid          primary key default gen_random_uuid(),
  user_id    uuid          not null references auth.users(id) on delete cascade,
  item_id    uuid          not null references public.items(id) on delete cascade,
  change     numeric(12,2) not null,   -- +restock / -sale / ± adjustment
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

-- 5) KEEP items.stock_qty IN SYNC WITH THE LEDGER --------------------------
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.items set stock_qty = stock_qty + new.change where id = new.item_id;
  elsif (tg_op = 'DELETE') then
    update public.items set stock_qty = stock_qty - old.change where id = old.item_id;
  elsif (tg_op = 'UPDATE') then
    update public.items set stock_qty = stock_qty - old.change + new.change
     where id = new.item_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
create trigger trg_apply_stock_movement
  after insert or update or delete on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- 6) AUTO SALE / RETURN FROM BILL LINES ------------------------------------
-- Fires on your existing createBill / updateBill / deleteBill flows. Only acts
-- when the linked item has track_stock = true.
create or replace function public.bill_item_stock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_track boolean;
  v_user  uuid;
begin
  if (tg_op = 'INSERT') then
    if new.item_id is null then return new; end if;
    select track_stock, user_id into v_track, v_user from public.items where id = new.item_id;
    if v_track then
      insert into public.stock_movements (user_id, item_id, change, reason, bill_id)
      values (v_user, new.item_id, -new.qty, 'sale', new.bill_id);
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if old.item_id is null then return old; end if;
    select track_stock, user_id into v_track, v_user from public.items where id = old.item_id;
    if v_track then
      -- bill_id left NULL: on a full bill delete the parent row is disappearing,
      -- so we don't reference it (avoids an FK race during the cascade).
      insert into public.stock_movements (user_id, item_id, change, reason, note)
      values (v_user, old.item_id, old.qty, 'return', 'bill line removed');
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bill_item_stock on public.bill_items;
create trigger trg_bill_item_stock
  after insert or delete on public.bill_items
  for each row execute function public.bill_item_stock();

-- 7) MANUAL ADJUSTMENTS (stock-in / correction / opening) ------------------
-- SECURITY DEFINER but verifies the caller actually owns the item.
create or replace function public.adjust_stock(
  p_item_id uuid,
  p_change  numeric,
  p_reason  text,
  p_note    text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid;
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

-- ===========================================================================
-- Done. To enable inventory for a user, the admin flips it in the Admin page
-- (or run: update public.subscriptions set inventory_enabled = true
--          where user_id = '<uuid>';).
-- ===========================================================================
