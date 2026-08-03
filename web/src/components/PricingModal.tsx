// ---------------------------------------------------------------------------
// PRICING MODAL — Interactive Subscription Selector & Razorpay Checkout
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Modal, Button, Card, Spinner } from './UI';
import { processRazorpayPayment } from '../services/paymentService';
import type { PlanKey } from '../services/subscriptionService';

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export const PRICING_PLANS = [
  {
    key: '1m' as PlanKey,
    title: '1 Month',
    price: '₹799',
    amount: 799,
    period: '/ month',
    tag: 'Pay as you go',
    popular: false,
    features: ['Full Web & Mobile Sync', 'Unlimited Invoices & Receipts', 'WhatsApp Bill Sharing', '5-Min Emergency Support'],
  },
  {
    key: '3m' as PlanKey,
    title: '3 Months',
    price: '₹2,199',
    amount: 2199,
    period: '/ 3 months',
    tag: 'Save 10%',
    popular: false,
    features: ['Full Web & Mobile Sync', 'Unlimited Invoices & Receipts', 'WhatsApp Bill Sharing', '5-Min Emergency Support', 'Inventory Tracking Enabled'],
  },
  {
    key: '6m' as PlanKey,
    title: '6 Months',
    price: '₹3,999',
    amount: 3999,
    period: '/ 6 months',
    tag: 'Save 17%',
    popular: false,
    features: ['Full Web & Mobile Sync', 'Unlimited Invoices & Receipts', 'WhatsApp Bill Sharing', '5-Min Emergency Support', 'Inventory Tracking Enabled', 'Custom Logo on Invoices'],
  },
  {
    key: '1y' as PlanKey,
    title: '1 Year (12 Months)',
    price: '₹7,999',
    amount: 7999,
    period: '/ year',
    tag: '⭐ BEST VALUE — 2 Months FREE',
    popular: true,
    features: ['Full Web & Mobile Sync', 'Unlimited Invoices & Receipts', 'WhatsApp Bill Sharing', '5-Min Emergency Walk-in Support', 'Full Inventory Management', 'Custom Invoice Logo & Branding', 'Priority New Feature Requests'],
  },
];

export function PricingModal({ open, onClose, onSuccess }: PricingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingKey, setLoadingKey] = useState<PlanKey | null>(null);

  async function handlePay(planKey: PlanKey) {
    if (!user) return;
    setLoadingKey(planKey);

    try {
      await processRazorpayPayment({
        planKey,
        userEmail: user.email || '',
        businessName: 'BusinessSathi Customer',
        onSuccess: (paymentId) => {
          setLoadingKey(null);
          toast(`🎉 Payment Successful! (ID: ${paymentId}). Subscription Active!`, 'success');
          if (onSuccess) onSuccess();
          onClose();
        },
        onError: (err) => {
          setLoadingKey(null);
          toast(err || 'Payment cancelled.', 'error');
        },
      });
    } catch (e: any) {
      setLoadingKey(null);
      toast(e?.message || 'Could not start payment.', 'error');
    }
  }

  return (
    <Modal open={open} title="💳 Upgrade BusinessSathi Subscription" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Choose a subscription plan to unlock full invoicing, inventory, thermal printing, and 5-minute counter support.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {PRICING_PLANS.map(p => (
          <div
            key={p.key}
            style={{
              border: p.popular ? '2px solid var(--primary)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              background: p.popular ? 'var(--primary-soft)' : 'var(--surface)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {p.popular && (
              <span
                style={{
                  position: 'absolute',
                  top: -12,
                  right: 12,
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 12,
                }}
              >
                MOST POPULAR
              </span>
            )}

            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.title}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: 'var(--primary)' }}>
                {p.price} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>{p.period}</span>
              </div>
              <span className="badge badge-success" style={{ marginTop: 6, display: 'inline-block' }}>
                {p.tag}
              </span>

              <ul style={{ paddingLeft: 18, marginTop: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                {p.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 16 }}>
              <Button
                title={loadingKey === p.key ? 'Opening Razorpay...' : `Subscribe for ${p.price}`}
                variant={p.popular ? 'primary' : 'secondary'}
                block
                disabled={loadingKey !== null}
                onClick={() => handlePay(p.key)}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
