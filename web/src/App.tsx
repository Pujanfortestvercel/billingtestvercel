// ---------------------------------------------------------------------------
// APP ROUTER — decides WHICH part of the app to show, mirroring the original
// RootNavigator:
//   • not logged in              → Auth screens (Login/Signup)
//   • logged in as ADMIN          → Admin page
//   • logged in, account FROZEN   → "awaiting approval" screen
//   • logged in, trial/active     → the billing app (sidebar layout)
// ---------------------------------------------------------------------------
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import {
  SubscriptionProvider,
  useSubscription,
} from './context/SubscriptionContext';
import { SettingsProvider } from './context/SettingsContext';
import { isSupabaseConfigured } from './config/supabase';
import { Spinner } from './components/UI';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { ItemsPage } from './pages/ItemsPage';
import { InventoryPage } from './pages/InventoryPage';
import { BillingPage } from './pages/BillingPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { NotConfiguredPage } from './pages/NotConfiguredPage';

function UserApp() {
  const { status, loading, inventoryEnabled } = useSubscription();
  if (loading) return <Spinner text="Loading…" />;
  if (status === 'frozen' || status === 'expired') return <PendingApprovalPage />;
  return (
    <SettingsProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/items" element={<ItemsPage />} />
          {inventoryEnabled ? (
            <Route path="/inventory" element={<InventoryPage />} />
          ) : null}
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </SettingsProvider>
  );
}

export function App() {
  const { user, isAdmin, initializing, profileLoading } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) return <NotConfiguredPage />;
  if (initializing) return <Spinner text="Starting…" />;

  // Not logged in → auth screens only.
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="*"
          element={<Navigate to="/login" replace state={{ from: location }} />}
        />
      </Routes>
    );
  }

  if (profileLoading) return <Spinner text="Loading your account…" />;
  if (isAdmin) return <AdminPage />;

  return (
    <SubscriptionProvider>
      <UserApp />
    </SubscriptionProvider>
  );
}
