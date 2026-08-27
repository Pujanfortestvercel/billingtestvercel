// ---------------------------------------------------------------------------
// LAYOUT — the shell for logged-in business users: sidebar + topbar.
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { APP_NAME } from '../config/constants';
import { Button } from './UI';
import { ExpiryReminder } from './ExpiryReminder';

type NavItem = { to: string; labelKey: string; icon: string; end?: boolean };

const NAV: NavItem[] = [
  { to: '/', labelKey: 'dashboard', icon: '🏠', end: true },
  { to: '/billing', labelKey: 'newBill', icon: '🧾' },
  { to: '/online-orders', labelKey: 'onlineOrders', icon: '🛍️' },
  { to: '/customers', labelKey: 'customers', icon: '👥' },
  { to: '/items', labelKey: 'items', icon: '📦' },
  { to: '/inventory', labelKey: 'inventory', icon: '📊' },
  { to: '/history', labelKey: 'billHistory', icon: '🗂️' },
  { to: '/settings', labelKey: 'settings', icon: '⚙️' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { settings, store } = useSettings();
  const { status, daysLeft } = useSubscription();
  const { lang, setLang, t, languages } = useLanguage();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
            style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'cover' }}
          />
        ) : (
          <img
            src="/logo.png"
            alt="BusinessSathi Logo"
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
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

      {NAV.map(n => (
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
          {t(n.labelKey)}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      {/* 21-Day Free Trial / Subscription Badge */}
      <div
        style={{
          background: status === 'trial' ? 'var(--warning-soft)' : status === 'active' ? 'var(--success-soft)' : 'var(--danger-soft)',
          border: `1px solid ${status === 'trial' ? 'var(--warning)' : status === 'active' ? 'var(--success)' : 'var(--danger)'}`,
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: status === 'trial' ? 'var(--warning)' : status === 'active' ? 'var(--success)' : 'var(--danger)' }}>
          {status === 'trial' ? `🎁 ${t('freeTrial')}` : status === 'active' ? '✨ Active Plan' : '⚠️ Trial Expired'}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
          {status === 'trial'
            ? `${daysLeft} ${t('daysRemaining')}`
            : daysLeft === -1
            ? 'Permanent Access'
            : `${daysLeft} ${t('daysRemaining')}`}
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 14,
          fontSize: 13,
        }}
      >
        <div className="muted" style={{ marginBottom: 4 }}>
          {t('signedInAs')}
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
          <Button title={t('logOut')} variant="ghost" small block onClick={signOut} />
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Language Picker Dropdown */}
            <select
              value={lang}
              onChange={e => setLang(e.target.value as any)}
              style={{
                height: 36,
                padding: '0 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {languages.map(l => (
                <option key={l.key} value={l.key}>
                  {l.flag} {l.nativeName}
                </option>
              ))}
            </select>

            <a
              href="/BusinessSathi.apk"
              download="BusinessSathi.apk"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              📲 {t('downloadOurApp')}
            </a>
            <Button
              title={`+ ${t('newBill')}`}
              small
              onClick={() => navigate('/billing')}
            />
          </div>
        </header>

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
