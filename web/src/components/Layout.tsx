// ---------------------------------------------------------------------------
// LAYOUT — the shell for logged-in business users: sidebar + topbar.
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useSettings } from '../context/SettingsContext';
import { APP_NAME } from '../config/constants';
import { Button } from './UI';
import { ExpiryReminder } from './ExpiryReminder';

type NavItem = { to: string; label: string; icon: string; end?: boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/billing', label: 'New Bill', icon: '🧾' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/items', label: 'Items', icon: '📦' },
  { to: '/history', label: 'Bill History', icon: '🗂️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

const INVENTORY_NAV: NavItem = { to: '/inventory', label: 'Inventory', icon: '📊' };

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { status, daysLeft, inventoryEnabled } = useSubscription();
  const { settings, store } = useSettings();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = inventoryEnabled
    ? [...NAV.slice(0, 4), INVENTORY_NAV, ...NAV.slice(4)]
    : NAV;

  const statusBadge =
    status === 'active' ? (
      <span className="badge badge-success">
        {daysLeft === -1 ? 'Subscribed (Permanent)' : `Subscribed · ${daysLeft}d left`}
      </span>
    ) : status === 'trial' ? (
      <span className="badge badge-success">
        Trial · {daysLeft}d left
      </span>
    ) : (
      <span className="badge badge-danger">Expired</span>
    );

  const sidebar = (
    <aside
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '20px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 10px 18px',
        }}
      >
        {settings?.logo_url ? (
          <img
            src={settings.logo_url}
            alt=""
            style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 26 }}>{store.emoji}</span>
        )}
        <div style={{ minWidth: 0 }}>
          <strong
            style={{
              fontSize: 16,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {settings?.shop_name || APP_NAME}
          </strong>
          <span className="muted" style={{ fontSize: 11 }}>
            {store.label}
          </span>
        </div>
      </div>

      {navItems.map(n => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setDrawerOpen(false)}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 14px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            color: isActive ? 'var(--primary)' : 'var(--text)',
            background: isActive ? 'var(--primary-soft)' : 'transparent',
          })}
        >
          <span style={{ fontSize: 18 }}>{n.icon}</span>
          {n.label}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 14,
          fontSize: 13,
        }}
      >
        <div className="muted" style={{ marginBottom: 4 }}>
          Signed in as
        </div>
        <div
          style={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user?.email}
        </div>
        <div style={{ marginTop: 12 }}>
          <Button title="Log out" variant="ghost" small block onClick={signOut} />
        </div>
      </div>
    </aside>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">{sidebar}</div>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 90,
          }}
        >
          <div onClick={e => e.stopPropagation()}>{sidebar}</div>
        </div>
      ) : null}

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 22px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <button
              className="btn btn-ghost btn-sm mobile-only"
              onClick={() => setDrawerOpen(true)}
              style={{ padding: '0 10px' }}
            >
              ☰
            </button>
            {statusBadge}
          </div>
          <Button
            title="+ New Bill"
            small
            onClick={() => navigate('/billing')}
          />
        </header>

        {/* Renewal / expiry banner */}
        {status === 'expired' ? (
          <div
            style={{
              background: 'var(--danger-soft)',
              color: 'var(--danger)',
              borderBottom: '1px solid var(--danger)',
              padding: '12px 22px',
              fontWeight: 600,
            }}
          >
            ⛔ Your subscription has expired — billing is disabled. Please contact
            your admin to renew.
          </div>
        ) : null}

        <ExpiryReminder />

        <div
          className="page-enter"
          style={{ padding: '24px 22px', maxWidth: 1080, width: '100%', margin: '0 auto' }}
        >
          {children}
        </div>
      </main>

      <style>{`
        .sidebar-desktop { display: block; }
        .mobile-only { display: none; }
        @media (max-width: 860px) {
          .sidebar-desktop { display: none; }
          .mobile-only { display: inline-flex; }
        }
      `}</style>
    </div>
  );
}
