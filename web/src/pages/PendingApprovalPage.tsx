import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Button, Card } from '../components/UI';

export function PendingApprovalPage() {
  const { user, signOut } = useAuth();
  const { refresh, status } = useSubscription();
  const [checking, setChecking] = useState(false);

  async function checkAgain() {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  const isExpired = status === 'expired';

  return (
    <div style={{ maxWidth: 520, margin: '70px auto', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 56 }}>{isExpired ? '⏳' : '🔒'}</div>
        <h1>{isExpired ? 'Subscription Expired' : 'Account not active yet'}</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          {isExpired ? (
            <>
              Your subscription for <strong>{user?.email}</strong> has expired. 
              An admin needs to assign a plan to reactivate your account.
            </>
          ) : (
            <>
              Your account (<strong>{user?.email}</strong>) is frozen. An admin needs
              to unfreeze it to start your 21-day free trial. Please check back soon.
            </>
          )}
        </p>
      </div>
      <Card>
        <p className="muted" style={{ marginTop: 0 }}>Already approved? Refresh your status.</p>
        <Button title="Check again" block loading={checking} onClick={checkAgain} />
      </Card>
      <div style={{ marginTop: 18 }}>
        <Button title="Log out" variant="danger" block onClick={signOut} />
      </div>
    </div>
  );
}
