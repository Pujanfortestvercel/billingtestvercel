// ---------------------------------------------------------------------------
// SUBSCRIPTION CONTEXT — loads the logged-in user's trial/subscription once
// and shares it (status + days left + whether the app is usable) with every
// screen, so billing can be blocked when expired and the dashboard can show a
// countdown. Call `refresh()` after changes.
// ---------------------------------------------------------------------------
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import type { Subscription } from '../types/models';
import {
  computeStatus,
  getSubscription,
  isAppUsable,
  type SubStatus,
} from '../services/subscriptionService';

type SubscriptionContextValue = {
  subscription: Subscription | null;
  status: SubStatus;
  daysLeft: number;
  isUsable: boolean;
  inventoryEnabled: boolean; // admin-gated feature flag (migration 004)
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
);

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Retry transient failures: a thrown error used to bubble as an unhandled
    // rejection AND leave `subscription` null, which reads downstream as
    // "expired" — locking a paying user out over a momentary network blip.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sub = await getSubscription(user.id);
        setSubscription(sub);
        setLoading(false);
        return;
      } catch (e) {
        if (attempt === 2) {
          console.error('Could not load subscription:', e);
          setLoading(false);
          return;
        }
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { status, daysLeft } = computeStatus(subscription);

  const value: SubscriptionContextValue = {
    subscription,
    status,
    daysLeft,
    isUsable: isAppUsable(subscription),
    inventoryEnabled: !!subscription?.inventory_enabled,
    loading,
    refresh,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used inside a <SubscriptionProvider>');
  }
  return ctx;
}
