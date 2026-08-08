// ---------------------------------------------------------------------------
// SUBSCRIPTION CONTEXT — PERMANENT UNLIMITED ACCESS & INVENTORY ENABLED
// ---------------------------------------------------------------------------
import {
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
  type SubStatus,
} from '../services/subscriptionService';

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
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
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

  const value: SubscriptionContextValue = {
    subscription,
    status: 'active',
    daysLeft: -1,
    isUsable: true,
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
