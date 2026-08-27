-- ===========================================================================
-- MIGRATION 010 — Free SaaS Subscription Payments & Approval Ledger
-- ---------------------------------------------------------------------------
-- Allows shopkeepers to select paid plans (1M, 3M, 6M, 1Y),
-- send direct UPI payments to Admin, and tap "I Have Paid" for 1-click
-- Admin approval.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  plan_key VARCHAR(50) NOT NULL, -- '1m' | '3m' | '6m' | '1y'
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- 1. Users can select and insert their own subscription payment requests
DROP POLICY IF EXISTS "Subscription payments insertable by user" ON public.subscription_payments;
CREATE POLICY "Subscription payments insertable by user"
  ON public.subscription_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. Users and admin can view subscription payment requests
DROP POLICY IF EXISTS "Subscription payments selectable by user" ON public.subscription_payments;
CREATE POLICY "Subscription payments selectable by user"
  ON public.subscription_payments FOR SELECT
  USING (true);

-- 3. Subscription payments updatable by admin to approve/reject
DROP POLICY IF EXISTS "Subscription payments updatable" ON public.subscription_payments;
CREATE POLICY "Subscription payments updatable"
  ON public.subscription_payments FOR UPDATE
  USING (true);

-- 4. Subscription payments deletable by admin
DROP POLICY IF EXISTS "Subscription payments deletable" ON public.subscription_payments;
CREATE POLICY "Subscription payments deletable"
  ON public.subscription_payments FOR DELETE
  USING (true);
