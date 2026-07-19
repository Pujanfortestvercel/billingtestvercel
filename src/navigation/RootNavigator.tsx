// ---------------------------------------------------------------------------
// ROOT NAVIGATOR — decides WHICH part of the app to show:
//   • not logged in              → Auth screens (Login/Signup)
//   • logged in as ADMIN          → Admin page (approve sign-ups, manage subs)
//   • logged in, account PENDING  → "awaiting approval" screen
//   • logged in, trial/active     → the billing app (tabs)
// ---------------------------------------------------------------------------
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { SubscriptionProvider, useSubscription } from '../context/SubscriptionContext';
import { SettingsProvider } from '../context/SettingsContext';
import { Loading } from '../components/common/Loading';
import { AuthStack } from './AuthStack';
import { AppStack } from './AppStack';
import { AdminStack } from './AdminStack';
import { PendingApprovalScreen } from '../screens/PendingApprovalScreen';

// What a logged-in NORMAL user sees, based on their subscription state.
function UserApp() {
  const { status, loading } = useSubscription();
  if (loading) return <Loading text="Loading…" />;
  if (status === 'frozen') return <PendingApprovalScreen />;
  return <AppStack />;
}

export function RootNavigator() {
  const { user, isAdmin, profileLoading } = useAuth();

  if (!user) return <AuthStack />;
  if (profileLoading) return <Loading text="Loading your account…" />;
  if (isAdmin) return <AdminStack />;

  return (
    <SubscriptionProvider>
      <SettingsProvider>
        <UserApp />
      </SettingsProvider>
    </SubscriptionProvider>
  );
}
