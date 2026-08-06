// ---------------------------------------------------------------------------
// PRICING MODAL — 100% Automated Bank SMS Payment Verification Gateway
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Modal, Button, Card, Spinner } from './UI';
import type { PlanKey } from '../services/subscriptionService';
import { createPendingOrder, checkOrderVerified } from '../services/smsWebhookService';

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
  const [selectedPlan, setSelectedPlan] = useState<typeof PRICING_PLANS[0] | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const upiId = 'bharwada.k.pujan@okaxis';

  function copyUpiId() {
    navigator.clipboard.writeText(upiId);
    toast('UPI ID copied to clipboard! 📋', 'success');
  }

  // When a plan is selected, create pending order and start live polling
  async function handleSelectPlan(plan: typeof PRICING_PLANS[0]) {
    setSelectedPlan(plan);
    setLoadingOrder(true);
    try {
      const ref = await createPendingOrder(plan.key, plan.amount);
      setOrderRef(ref);
    } catch {
      setOrderRef(Math.floor(1000 + Math.random() * 9000).toString());
    } finally {
      setLoadingOrder(false);
    }
  }

  // Live 3-second polling — ONLY activates when Bank SMS Webhook is received!
  useEffect(() => {
    if (!selectedPlan || !orderRef || !open) return;

    const interval = setInterval(async () => {
      const isVerified = await checkOrderVerified(orderRef);
      if (isVerified) {
        clearInterval(interval);
        toast(`🎉 Payment Verified by Bank SMS! ${selectedPlan.title} Active!`, 'success');
        if (onSuccess) onSuccess();
        onClose();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedPlan, orderRef, open]);

  if (!open) return null;

  return (
    <Modal open={open} title={selectedPlan ? `💳 Pay for ${selectedPlan.title}` : "💳 Subscribe to BusinessSathi"} onClose={() => { setSelectedPlan(null); setOrderRef(null); onClose(); }}>
      <div style={{ maxHeight: '78vh', overflowY: 'auto', paddingRight: 4 }}>
        {!selectedPlan ? (
          <div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
              Choose a plan. Automatic Bank SMS verification — 0% transaction fees!
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
                      title={`Subscribe for ${p.price}`}
                      variant={p.popular ? 'primary' : 'secondary'}
                      block
                      onClick={() => handleSelectPlan(p)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* Selected Plan Summary */}
            <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{selectedPlan.title} Plan</strong>
                <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 20 }}>{selectedPlan.price}</div>
              </div>
              <Button title="← Change Plan" variant="ghost" small onClick={() => { setSelectedPlan(null); setOrderRef(null); }} />
            </div>

            {/* Direct GPay QR Gateway Card */}
            <div style={{ textAlign: 'center' }}>
              <Card style={{ padding: 16, display: 'inline-block', maxWidth: 340, width: '100%' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)' }}>
                  Scan & Pay with GPay / PhonePe / Paytm / BHIM
                </div>

                {orderRef && (
                  <div style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary)', padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                    Add Note in UPI App: <span style={{ fontSize: 15, fontWeight: 800 }}>REF {orderRef}</span>
                  </div>
                )}

                {/* Google Pay QR Code Image */}
                <img
                  src="/upi_qr_scanner.png"
                  alt="UPI QR Code"
                  style={{ width: '100%', maxWidth: 230, height: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}
                />

                <div style={{ marginTop: 12, fontSize: 13, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, wordBreak: 'break-all' }}>{upiId}</span>
                  <button className="btn btn-ghost btn-sm" onClick={copyUpiId} style={{ padding: '2px 8px' }}>
                    📋 Copy
                  </button>
                </div>

                {/* 1-Tap Open UPI Link */}
                <a
                  href={`upi://pay?pa=${upiId}&pn=BusinessSathi&am=${selectedPlan.amount}&tn=REF%20${orderRef || ''}&cu=INR`}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 12, textDecoration: 'none', display: 'block', textAlign: 'center', fontWeight: 700 }}
                >
                  🚀 Pay {selectedPlan.price} via Any UPI App (GPay / PhonePe / Paytm)
                </a>
              </Card>

              {/* Live Automated Verification Indicator */}
              <div style={{ marginTop: 16, background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                  <Spinner /> ⌛ Waiting for Bank SMS Verification...
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                  Screen auto-updates to <strong>Subscription Active</strong> the instant your bank SMS arrives!
                </p>
              </div>

              {/* 1-Tap Send Payment Proof on WhatsApp */}
              <div style={{ marginTop: 14 }}>
                <a
                  href={`https://wa.me/919324357300?text=${encodeURIComponent(`Hii! I have paid ${selectedPlan.price} for ${selectedPlan.title} subscription. User: ${user?.email || 'No Email'} (Ref: ${orderRef || ''})`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ width: '100%', textDecoration: 'none', display: 'block', textAlign: 'center', fontWeight: 700 }}
                >
                  💬 I Have Paid (Send Proof on WhatsApp)
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
