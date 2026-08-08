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
  inventoryEnabled: boolean; // admin-gated inventory feature flag
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
    try {
      const sub = await getSubscription(user.id);
      setSubscription(sub);
    } finally {
      setLoading(false);
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
    inventoryEnabled: true, // Permanent 100% enabled for all users
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
