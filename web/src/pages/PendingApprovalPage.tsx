import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Button, Card, Spinner } from '../components/UI';
import {
  PLANS,
  submitSubscriptionPayment,
  getUserPendingPayment,
} from '../services/subscriptionService';

const ADMIN_UPI_ID = 'pujanbharwada1@gmail.com';
const ADMIN_NAME = 'BusinessSathi Admin';

export function PendingApprovalPage({ forceShow }: { forceShow?: boolean }) {
  const { user, signOut } = useAuth();
  const { refresh, status } = useSubscription();
  const navigate = useNavigate();

  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('1y');
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const activePlans = PLANS.filter(p => p.price > 0);
  const currentPlan = activePlans.find(p => p.key === selectedPlanKey) || activePlans[0];

  useEffect(() => {
    if (!user?.id) return;
    getUserPendingPayment(user.id)
      .then(setPendingPayment)
      .catch(() => setPendingPayment(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  async function checkAgain() {
    setChecking(true);
    try {
      await refresh();
      if (user?.id) {
        const p = await getUserPendingPayment(user.id);
        setPendingPayment(p);
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleMarkPaid() {
    if (!user?.id || !user?.email) return;
    setSubmitting(true);
    try {
      await submitSubscriptionPayment(
        user.id,
        user.email,
        currentPlan.key,
        currentPlan.price,
      );
      setSubmittedSuccess(true);
      const p = await getUserPendingPayment(user.id);
      setPendingPayment(p);
    } catch (e: any) {
      alert(e?.message ?? 'Could not submit payment request.');
    } finally {
      setSubmitting(false);
    }
  }

  // Generate NPCI Standard UPI String for exact plan price
  const upiUri = `upi://pay?pa=${encodeURIComponent(ADMIN_UPI_ID)}&pn=${encodeURIComponent(ADMIN_NAME)}&am=${currentPlan.price.toFixed(2)}&tn=${encodeURIComponent(`Subscription ${currentPlan.label} - ${user?.email}`)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

  const isExpired = status === 'expired';

  if (loading) return <Spinner text="Checking account status…" />;

  return (
    <div style={{ maxWidth: 650, margin: '20px auto', padding: '0 16px' }}>
      {forceShow ? (
        <div style={{ marginBottom: 16 }}>
          <Button title="← Back to Dashboard" variant="ghost" small onClick={() => navigate('/')} />
        </div>
      ) : null}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 52 }}>{isExpired ? '⏳' : forceShow ? '⭐' : '🔒'}</div>
        <h1 style={{ margin: '8px 0 4px' }}>
          {isExpired ? '21-Day Free Trial Expired' : forceShow ? 'Upgrade BusinessSathi Plan' : 'Account Pending Activation'}
        </h1>
        <p className="muted" style={{ lineHeight: 1.5, margin: 0 }}>
          {isExpired ? (
            <>
              Your 21-day trial for <strong>{user?.email}</strong> has ended.
              Select a plan below to upgrade and continue using BusinessSathi.
            </>
          ) : (
            <>
              Your account <strong>{user?.email}</strong> is waiting for activation.
              Select a plan below to activate your account.
            </>
          )}
        </p>
      </div>

      {pendingPayment || submittedSuccess ? (
        <Card style={{ textAlign: 'center', padding: 24, marginBottom: 20, borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Payment Notification Sent!</h3>
          <p className="muted" style={{ margin: 0 }}>
            We received your notification for the <strong>{planLabel(pendingPayment?.plan_key || selectedPlanKey)} (₹{pendingPayment?.amount || currentPlan.price})</strong>.
          </p>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Admin will verify your payment and activate your plan shortly.
          </p>
          <div style={{ marginTop: 16 }}>
            <Button title="🔄 Check Activation Status" block loading={checking} onClick={checkAgain} />
          </div>
        </Card>
      ) : (
        <>
          {/* Plan Selection Cards */}
          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>1. Choose Subscription Plan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {activePlans.map(p => {
                const active = p.key === selectedPlanKey;
                return (
                  <div
                    key={p.key}
                    onClick={() => setSelectedPlanKey(p.key)}
                    style={{
                      padding: 14,
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      background: active ? 'var(--primary-soft)' : 'var(--surface)',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {p.popular ? (
                      <span className="badge badge-primary" style={{ position: 'absolute', top: -10, right: 10, fontSize: 10 }}>
                        Best Value
                      </span>
                    ) : null}
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                      ₹{p.price}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {p.days ? `${p.days} days access` : 'Lifetime access'}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Payment Instructions & Dynamic QR Code */}
          <Card style={{ marginBottom: 20, textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>2. Pay via Direct UPI (0% Fee)</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Scan QR code using GPay, PhonePe, or Paytm for <strong>₹{currentPlan.price}</strong>
            </p>

            <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'center' }}>
              <img
                src={qrUrl}
                alt="UPI QR Code"
                style={{
                  width: 210,
                  height: 210,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  padding: 8,
                  background: '#fff',
                }}
              />
            </div>

            <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              <span className="muted">UPI ID: </span>
              <strong style={{ userSelect: 'all' }}>{ADMIN_UPI_ID}</strong>
            </div>

            {/* Mobile 1-Tap App Launchers */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              <a
                href={upiUri}
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none', fontWeight: 700 }}
              >
                📲 Open UPI App
              </a>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
              <Button
                title="✅ I Have Paid (Notify Admin)"
                block
                loading={submitting}
                onClick={handleMarkPaid}
              />
            </div>
          </Card>
        </>
      )}

      <Card style={{ marginBottom: 16 }}>
        <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>Already paid or approved? Check status below.</p>
        <Button title="🔄 Refresh Status" variant="ghost" block loading={checking} onClick={checkAgain} />
      </Card>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Button title="Log Out" variant="danger" small onClick={signOut} />
      </div>
    </div>
  );
}

function planLabel(key?: string) {
  const p = PLANS.find(x => x.key === key);
  return p?.label ?? 'Subscription Plan';
}
