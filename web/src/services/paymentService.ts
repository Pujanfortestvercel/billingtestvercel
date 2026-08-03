// ---------------------------------------------------------------------------
// PAYMENT SERVICE — Razorpay Checkout & Subscription Activation
// ---------------------------------------------------------------------------
import { RAZORPAY_KEY_ID } from '../config/razorpay';
import { supabase } from '../lib/supabase';
import { PLANS, type PlanKey } from './subscriptionService';

// Dynamically load the Razorpay checkout script if not already present
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export type CheckoutOptions = {
  planKey: PlanKey;
  userEmail: string;
  businessName?: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
};

export async function processRazorpayPayment(options: CheckoutOptions): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    options.onError('Failed to load Razorpay SDK. Check internet connection.');
    return;
  }

  const plan = PLANS.find(p => p.key === options.planKey);
  if (!plan) {
    options.onError('Invalid plan selected.');
    return;
  }

  // Plan pricing lookup (in INR)
  const planPrices: Record<string, number> = {
    '1m': 799,
    '3m': 2199,
    '6m': 3999,
    '1y': 7999,
  };

  const amountInRupees = planPrices[options.planKey] || 799;
  const amountInPaise = amountInRupees * 100;

  const rzpOptions = {
    key: RAZORPAY_KEY_ID,
    amount: amountInPaise,
    currency: 'INR',
    name: 'BusinessSathi',
    description: `Subscription: ${plan.label} (${options.planKey.toUpperCase()})`,
    image: '/icon.png',
    handler: async function (response: any) {
      try {
        const paymentId = response.razorpay_payment_id;
        // Activate subscription in Supabase database
        await activateUserSubscription(plan.key as PlanKey, paymentId);
        options.onSuccess(paymentId);
      } catch (err: any) {
        options.onError(err?.message || 'Payment completed but subscription activation failed.');
      }
    },
    prefill: {
      email: options.userEmail,
      name: options.businessName || 'Shopkeeper',
    },
    theme: {
      color: '#2563eb', // BusinessSathi primary blue
    },
  };

  const rzp = new (window as any).Razorpay(rzpOptions);
  rzp.on('payment.failed', function (resp: any) {
    options.onError(resp.error?.description || 'Payment failed or cancelled.');
  });
  rzp.open();
}

// Update the user's subscription in Supabase
export async function activateUserSubscription(planKey: PlanKey, paymentId?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const userId = userData.user.id;
  const plan = PLANS.find(p => p.key === planKey);
  if (!plan) throw new Error('Unknown plan');

  const now = new Date();
  // Duration calculation
  let days = plan.days || 30;
  if (planKey === '1m') days = 30;
  if (planKey === '3m') days = 90;
  if (planKey === '6m') days = 180;
  if (planKey === '1y') days = 365;

  const endDate = new Date(now.getTime() + days * 86400000);

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      status: 'active',
      plan: planKey,
      trial_start: now.toISOString(),
      trial_end: endDate.toISOString(),
      inventory_enabled: true,
      updated_at: now.toISOString(),
    });

  if (error) throw new Error(error.message);
}
