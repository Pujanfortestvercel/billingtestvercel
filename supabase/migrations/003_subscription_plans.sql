-- ===========================================================================
-- MIGRATION 003 — Subscription plans (trial / paid durations / permanent)
-- ---------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this → Run.
-- Safe to run more than once.
--
-- • Adds `plan` to subscriptions so the admin can assign a duration:
--     'trial' (21d), '1m', '3m', '6m', '1y', or 'permanent'.
-- • Makes `trial_end` nullable: a NULL end date means "permanent / unlimited".
--   For every other plan, trial_end holds the date access stops working.
-- ===========================================================================
alter table public.subscriptions
  add column if not exists plan text;

alter table public.subscriptions
  alter column trial_end drop not null;
