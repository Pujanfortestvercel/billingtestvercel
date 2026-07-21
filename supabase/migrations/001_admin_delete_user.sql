-- ===========================================================================
-- MIGRATION 001 — Admin "Delete account" support
-- ---------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this → Run.
-- Safe to run more than once.
--
-- Adds admin_delete_user(): an admin-only function that permanently deletes a
-- user. Deleting from auth.users cascades to that user's profile,
-- subscription, customers, items, bills and bill_items automatically.
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

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
