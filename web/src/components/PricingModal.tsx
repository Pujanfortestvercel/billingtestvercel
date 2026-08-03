// ---------------------------------------------------------------------------
// PRICING & PAYMENT MODAL — 100% Automated Razorpay Payment Gateway (UPI / Cards / Netbanking)
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Modal, Button } from './UI';
import { processRazorpayPayment } from '../services/paymentService';
import type { PlanKey } from '../services/subscriptionService';

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export const EQUAL_FEATURES = [
  '⚡ Full Web & Mobile App Sync',
  '🧾 Unlimited Invoices & Receipts',
  '💬 Instant WhatsApp Bill Sharing',
  '🏃 5-Min Emergency Walk-in Support',
  '📦 Full Inventory Management',
  '🏷️ Custom Invoice Logo & Branding',
  '🏪 All 6 Store Modes Unlocked',
];

export const PRICING_PLANS = [
  {
    key: '1m' as PlanKey,
    title: '1 Month',
    price: '₹800',
    amount: 800,
    period: '/ month',
    tag: '1 Month Commitment',
    popular: false,
  },
  {
    key: '3m' as PlanKey,
    title: '3 Months',
    price: '₹2,400',
    amount: 2400,
    period: '/ 3 months',
    tag: '3 Months Commitment',
    popular: false,
  },
  {
    key: '6m' as PlanKey,
    title: '6 Months',
    price: '₹4,800',
    amount: 4800,
    period: '/ 6 months',
    tag: '6 Months Commitment',
    popular: false,
  },
  {
    key: '1y' as PlanKey,
    title: '1 Year (12 Months)',
    price: '₹9,600',
    amount: 9600,
    period: '/ year',
    tag: '⭐ BEST VALUE — Full 1-Year Access',
    popular: true,
  },
];

export function PricingModal({ open, onClose, onSuccess }: PricingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingKey, setLoadingKey] = useState<PlanKey | null>(null);

  async function handleDirectRazorpayPay(planKey: PlanKey) {
    if (!user) return;
    setLoadingKey(planKey);

    try {
      await processRazorpayPayment({
        planKey,
        userEmail: user.email || '',
        businessName: 'BusinessSathi Customer',
        onSuccess: (paymentId) => {
          setLoadingKey(null);
          toast(`🎉 Payment Verified! (ID: ${paymentId}). Subscription Active!`, 'success');
          if (onSuccess) onSuccess();
          onClose();
        },
        onError: (err) => {
          setLoadingKey(null);
          toast(err || 'Payment cancelled or failed.', 'error');
        },
      });
    } catch (e: any) {
      setLoadingKey(null);
      toast(e?.message || 'Could not start payment gateway.', 'error');
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} title="💳 Select Subscription Plan" onClose={onClose}>
      <div style={{ maxHeight: '78vh', overflowY: 'auto', paddingRight: 4 }}>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          100% Automated Payment via GPay, PhonePe, Paytm, Cards, or Netbanking. Subscription activates instantly upon payment!
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
                  RECOMMENDED
                </span>
              )}

              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{p.title}</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: 'var(--primary)' }}>
                  {p.price} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>{p.period}</span>
                </div>
                <span className="badge badge-success" style={{ marginTop: 6, display: 'inline-block' }}>
                  {p.tag}
                </span>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                    INCLUDED IN THIS PLAN:
                  </div>
                  <ul style={{ paddingLeft: 16, margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                    {EQUAL_FEATURES.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <Button
                  title={loadingKey === p.key ? 'Opening Gateway...' : `Pay ${p.price} via GPay / Card`}
                  variant={p.popular ? 'primary' : 'secondary'}
                  block
                  disabled={loadingKey !== null}
                  onClick={() => handleDirectRazorpayPay(p.key)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
