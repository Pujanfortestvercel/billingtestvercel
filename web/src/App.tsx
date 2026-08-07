// ---------------------------------------------------------------------------
// APP ROUTER — handles public routes (/store/:userId), auth, and user app routes.
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
import { OnlineOrdersPage } from './pages/OnlineOrdersPage';
import { PublicStorePage } from './pages/PublicStorePage';
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
          <Route path="/online-orders" element={<OnlineOrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/store/:userId" element={<PublicStorePage />} />
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

  // Public Store Route — accessible to anyone without login!
  if (location.pathname.startsWith('/store/')) {
    return (
      <Routes>
        <Route path="/store/:userId" element={<PublicStorePage />} />
      </Routes>
    );
  }

  // Not logged in → auth screens or public store.
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/store/:userId" element={<PublicStorePage />} />
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
