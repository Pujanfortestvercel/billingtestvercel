// ---------------------------------------------------------------------------
// PRICING & PAYMENT MODAL — Direct GPay QR Code + Automated WhatsApp Payment Proof
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Modal, Button, Card } from './UI';
import type { PlanKey } from '../services/subscriptionService';
import { supabase } from '../lib/supabase';

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  whatsappNumber?: string; // e.g. "919876543210"
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

export function PricingModal({ open, onClose, onSuccess, whatsappNumber = '919876543210' }: PricingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<typeof PRICING_PLANS[0] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const upiId = 'bharwada.k.pujan@okaxis';

  function copyUpiId() {
    navigator.clipboard.writeText(upiId);
    toast('UPI ID copied to clipboard! 📋', 'success');
  }

  async function handlePaidClick() {
    if (!selectedPlan || !user) return;

    setSubmitting(true);
    try {
      // 1. Set subscription status to frozen (pending admin verification)
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        status: 'frozen',
        plan: selectedPlan.key,
        updated_at: new Date().toISOString(),
      });

      // 2. Auto-format WhatsApp message
      const userEmail = user.email || 'No Email';
      const messageText = `Hii I have paid ${selectedPlan.price} for ${selectedPlan.title} subscription. My email is ${userEmail}`;
      const encodedMsg = encodeURIComponent(messageText);

      // Clean phone number format for WhatsApp link
      const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

      toast('🎉 Payment confirmation sent! Opening WhatsApp...', 'success');
      setSubmitting(false);

      // 3. Open WhatsApp pre-filled chat in new window/tab
      window.open(waUrl, '_blank');

      setSelectedPlan(null);
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setSubmitting(false);
      toast(e?.message || 'Could not send payment notification.', 'error');
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} title={selectedPlan ? `💳 Pay for ${selectedPlan.title}` : "💳 Subscribe to BusinessSathi"} onClose={() => { setSelectedPlan(null); onClose(); }}>
      <div style={{ maxHeight: '78vh', overflowY: 'auto', paddingRight: 4 }}>
        {!selectedPlan ? (
          <div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
              All plans include 100% of all features, 5-minute emergency walk-in support, and full inventory sync!
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
                      title={`Select ${p.title} (${p.price})`}
                      variant={p.popular ? 'primary' : 'secondary'}
                      block
                      onClick={() => setSelectedPlan(p)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* Plan Selected Header */}
            <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{selectedPlan.title} Plan</strong>
                <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 20 }}>{selectedPlan.price}</div>
              </div>
              <Button title="← Change Plan" variant="ghost" small onClick={() => setSelectedPlan(null)} />
            </div>

            {/* QR Scanner Display */}
            <div style={{ textAlign: 'center' }}>
              <Card style={{ padding: 16, display: 'inline-block', maxWidth: 320, width: '100%' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                  Scan with GPay / PhonePe / Paytm
                </div>

                {/* GPay QR Scanner Image */}
                <img
                  src="/upi_qr_scanner.png"
                  alt="UPI QR Scanner"
                  style={{ width: '100%', maxWidth: 240, height: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}
                />

                <div style={{ marginTop: 12, fontSize: 13, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, wordBreak: 'break-all' }}>{upiId}</span>
                  <button className="btn btn-ghost btn-sm" onClick={copyUpiId} style={{ padding: '2px 8px' }}>
                    📋 Copy
                  </button>
                </div>

                <a
                  href={`upi://pay?pa=${upiId}&pn=BusinessSathi&am=${selectedPlan.amount}&cu=INR`}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 12, textDecoration: 'none', display: 'block', textAlign: 'center' }}
                >
                  🚀 Open GPay / PhonePe App
                </a>
              </Card>

              {/* The "I Have Paid" WhatsApp Action Button */}
              <div style={{ marginTop: 20 }}>
                <Button
                  title="✅ I Have Paid (Send Payment Proof on WhatsApp)"
                  variant="primary"
                  block
                  loading={submitting}
                  onClick={handlePaidClick}
                />
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Clicking "I Have Paid" will open WhatsApp with your pre-typed email and plan details to confirm your payment.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
