// ---------------------------------------------------------------------------
// PRICING & PAYMENT MODAL — Scrollable, 4 Equal-Feature Plans & UPI QR Scanner
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Modal, Button, Card, TextField } from './UI';
import { processRazorpayPayment, activateUserSubscription } from '../services/paymentService';
import type { PlanKey } from '../services/subscriptionService';
import { supabase } from '../lib/supabase';

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
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'razorpay'>('upi');
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [loadingKey, setLoadingKey] = useState<PlanKey | null>(null);

  const upiId = 'bharwada.k.pujan@okaxis';

  function copyUpiId() {
    navigator.clipboard.writeText(upiId);
    toast('UPI ID copied to clipboard! 📋', 'success');
  }

  async function handleUpiSubmit() {
    const utr = utrInput.trim();
    if (!utr || utr.length < 6) {
      toast('Please enter a valid 12-digit UTR / Reference number from your payment app.', 'error');
      return;
    }
    if (!selectedPlan || !user) return;

    setSubmittingUtr(true);
    try {
      // 1. Activate plan in Supabase
      await activateUserSubscription(selectedPlan.key);

      // 2. Record payment submission in payments table
      await supabase.from('stock_movements').insert({
        item_id: selectedPlan.key,
        user_id: user.id,
        change: selectedPlan.amount,
        reason: 'opening',
        note: `UPI Subscription UTR: ${utr} (${selectedPlan.title})`,
      });

      toast(`🎉 Payment submitted! UTR: ${utr}. Subscription active!`, 'success');
      setSubmittingUtr(false);
      setSelectedPlan(null);
      setUtrInput('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setSubmittingUtr(false);
      toast(e?.message || 'Could not process subscription activation.', 'error');
    }
  }

  async function handleRazorpayPay(planKey: PlanKey) {
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
          setSelectedPlan(null);
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

            {/* Payment Method Selector Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => setPaymentMethod('upi')}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${paymentMethod === 'upi' ? 'var(--primary)' : 'var(--border)'}`,
                  background: paymentMethod === 'upi' ? 'var(--primary-soft)' : 'var(--surface)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📲 Direct UPI QR (0% Fees)
              </button>
              <button
                onClick={() => setPaymentMethod('razorpay')}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${paymentMethod === 'razorpay' ? 'var(--primary)' : 'var(--border)'}`,
                  background: paymentMethod === 'razorpay' ? 'var(--primary-soft)' : 'var(--surface)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                💳 Razorpay (Card/Netbank)
              </button>
            </div>

            {paymentMethod === 'upi' ? (
              <div style={{ textAlign: 'center' }}>
                <Card style={{ padding: 16, display: 'inline-block', maxWidth: 320, width: '100%' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                    Scan with GPay / PhonePe / Paytm
                  </div>

                  {/* User's Exact Scanner QR Code Image */}
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
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 12, textDecoration: 'none', display: 'block', textAlign: 'center' }}
                  >
                    🚀 Open GPay / PhonePe App
                  </a>
                </Card>

                {/* UTR Verification Step */}
                <div style={{ marginTop: 16, textAlign: 'left' }}>
                  <TextField
                    label="Enter Payment UTR / Ref No. (12 digits)"
                    value={utrInput}
                    onChange={e => setUtrInput(e.target.value)}
                    placeholder="e.g. 421983019284"
                  />
                  <Button
                    title="✅ Submit UTR & Activate Plan"
                    variant="primary"
                    block
                    loading={submittingUtr}
                    onClick={handleUpiSubmit}
                  />
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p className="muted">
                  Click below to open Razorpay Secure Checkout for Credit/Debit Cards, Netbanking, or Wallet payment.
                </p>
                <Button
                  title={loadingKey === selectedPlan.key ? 'Opening Razorpay...' : `Pay ${selectedPlan.price} via Razorpay`}
                  variant="primary"
                  block
                  disabled={loadingKey !== null}
                  onClick={() => handleRazorpayPay(selectedPlan.key)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
