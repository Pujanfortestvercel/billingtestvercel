-- ===========================================================================
-- MIGRATION 006 — Comprehensive Database Hardening & Medical Bill Protection
-- ---------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this → Run.
-- Safe to run more than once.
-- ===========================================================================

-- 1) UNIQUE USER BILL NUMBER CONSTRAINT --------------------------------------
create unique index if not exists idx_bills_user_bill_number on public.bills(user_id, bill_number);

-- 2) MEDICAL STORE BILL DELETION PROTECTION TRIGGER -------------------------
create or replace function public.check_medical_bill_deletion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_store_type text;
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
