// ---------------------------------------------------------------------------
// SUBSCRIPTION CONTEXT — SHARED CONTEXT PROVIDER (UNLOCKED)
// ---------------------------------------------------------------------------
import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';
import type { Subscription } from '../types/models';
import type { SubStatus } from '../services/subscriptionService';

type SubscriptionContextValue = {
  subscription: Subscription | null;
  status: SubStatus;
  daysLeft: number;
  isUsable: boolean;
  inventoryEnabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
);

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const value: SubscriptionContextValue = {
    subscription: {
      id: 'active',
      user_id: 'active',
      trial_start: new Date().toISOString(),
      trial_end: null,
      status: 'active',
      plan: 'permanent',
      inventory_enabled: true,
    },
    status: 'active',
    daysLeft: -1,
    isUsable: true,
    inventoryEnabled: true,
    loading: false,
    refresh: async () => {},
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
