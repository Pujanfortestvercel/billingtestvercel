// ---------------------------------------------------------------------------
// DASHBOARD — welcome, subscription status, KPI cards, a 7-day revenue bar
// chart, and a recent-bills feed. (An upgrade over the original mobile home.)
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useSettings } from '../context/SettingsContext';
import { Button, Card, Spinner } from '../components/UI';
import { Capacitor } from '@capacitor/core';
import {
  getDashboardStats,
  type DashboardStats,
} from '../services/analyticsService';
import { getExpiringBatches, type ExpiringLine } from '../services/billService';
import { listLowStock } from '../services/inventoryService';
import type { Item } from '../types/models';
import { formatCurrency, formatDateTime } from '../utils/format';

export function DashboardPage() {
  const { user } = useAuth();
  const { status, daysLeft, loading: subLoading, inventoryEnabled } = useSubscription();
  const { store } = useSettings();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState<ExpiringLine[]>([]);
  const [lowStock, setLowStock] = useState<Item[]>([]);



  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!store.expiryAlerts) {
      setExpiring([]);
      return;
    }
    getExpiringBatches(60)
      .then(setExpiring)
      .catch(() => setExpiring([]));
  }, [store.expiryAlerts]);

  useEffect(() => {
    if (!inventoryEnabled) {
      setLowStock([]);
      return;
    }
    listLowStock()
      .then(setLowStock)
      .catch(() => setLowStock([]));
  }, [inventoryEnabled]);

  const daysToExpiry = (iso: string) =>
    Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000);

  const maxDay = stats ? Math.max(1, ...stats.last7.map(d => d.total)) : 1;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Welcome back, {user?.email}
      </p>

      {/* Subscription banner */}
      <Card style={{ marginBottom: 18 }}>
        <div className="row spread" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
              Subscription
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>
              {subLoading
                ? 'Checking…'
                : status === 'active'
                ? daysLeft === -1
                  ? 'Active ✓ (permanent)'
                  : `Subscribed — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                : status === 'trial'
                ? `Free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                : 'Expired — please contact admin to renew'}
            </div>
          </div>
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <Button title="🧾 Create new bill" onClick={() => navigate('/billing')} />
          </div>
        </div>
      </Card>

      {/* Expiry reminders (medical stores) */}
      {store.expiryAlerts && expiring.length > 0 ? (
        <Card
          style={{
            marginBottom: 18,
            borderColor: 'var(--warning)',
            background: 'var(--warning-soft)',
          }}
        >
          <div className="row spread">
            <strong>⏰ Expiry reminders</strong>
            <span className="badge badge-warning">{expiring.length}</span>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>
            Batches sold that are expired or expiring within 60 days.
          </p>
          {expiring.slice(0, 6).map(e => {
            const d = daysToExpiry(e.expiry_date);
            return (
              <div
                key={e.id}
                className="row spread"
                style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{e.item_name}</strong>{' '}
                  {e.batch_no ? <span className="muted">· batch {e.batch_no}</span> : null}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {e.bill_number} · {e.customer_name}
                  </div>
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: d < 0 ? 'var(--danger)' : 'var(--warning)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d < 0 ? `expired ${Math.abs(d)}d ago` : `in ${d}d`} · {e.expiry_date}
                </span>
              </div>
            );
          })}
          {expiring.length > 6 ? (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              + {expiring.length - 6} more…
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Low-stock reminders (inventory enabled) */}
      {inventoryEnabled && lowStock.length > 0 ? (
        <Card
          style={{
            marginBottom: 18,
            borderColor: 'var(--danger)',
            background: 'var(--danger-soft)',
          }}
        >
          <div className="row spread">
            <strong>📦 Low stock</strong>
            <span className="badge badge-danger">{lowStock.length}</span>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>
            Items at or below their reorder level.
          </p>
          {lowStock.slice(0, 6).map(it => (
            <div
              key={it.id}
              className="row spread"
              style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}
            >
              <strong style={{ minWidth: 0 }}>{it.item_name}</strong>
              <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                {it.stock_qty ?? 0} left
                <span className="muted"> · reorder at {it.reorder_level ?? 0}</span>
              </span>
            </div>
          ))}
          <div className="row spread" style={{ marginTop: 10 }}>
            {lowStock.length > 6 ? (
              <span className="muted" style={{ fontSize: 12 }}>
                + {lowStock.length - 6} more…
              </span>
            ) : <span />}
            <Button title="Manage items" variant="ghost" small onClick={() => navigate('/items')} />
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Spinner text="Loading your numbers…" />
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 14,
              marginBottom: 18,
            }}
          >
            <Kpi label="Revenue (total)" value={formatCurrency(stats.revenueTotal)} accent />
            <Kpi label="Revenue (this month)" value={formatCurrency(stats.revenueThisMonth)} />
            <Kpi label="Bills" value={String(stats.bills)} />
            <Kpi label="Customers" value={String(stats.customers)} />
            <Kpi label="Items" value={String(stats.items)} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: 14,
            }}
            className="dash-grid"
          >
            {/* 7-day chart */}
            <Card>
              <h3 style={{ marginTop: 0 }}>Last 7 days</h3>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 10,
                  height: 160,
                  marginTop: 16,
                }}
              >
                {stats.last7.map((d, i) => (
                  <div
                    key={i}
                    style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
                    title={formatCurrency(d.total)}
                  >
                    <div
                      style={{
                        background:
                          d.total > 0 ? 'var(--primary)' : 'var(--border)',
                        height: `${Math.max(4, (d.total / maxDay) * 130)}px`,
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {d.label}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent bills */}
            <Card>
              <h3 style={{ marginTop: 0 }}>Recent bills</h3>
              {stats.recent.length === 0 ? (
                <p className="muted">No bills yet — create your first one.</p>
              ) : (
                stats.recent.map(b => (
                  <div
                    key={b.id}
                    className="row spread"
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.customer_name}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {b.bill_number} · {formatDateTime(b.created_at)}
                      </div>
                    </div>
                    <strong style={{ color: 'var(--primary)' }}>
                      {formatCurrency(b.total_amount)}
                    </strong>
                  </div>
                ))
              )}
              <div style={{ marginTop: 14 }}>
                <Button
                  title="View all history"
                  variant="ghost"
                  small
                  block
                  onClick={() => navigate('/history')}
                />
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card>Could not load dashboard data.</Card>
      )}

      <style>{`
        @media (max-width: 760px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card style={accent ? { background: 'var(--primary)', color: '#fff', border: 'none' } : undefined}>
      <div style={{ fontSize: 13, fontWeight: 600, opacity: accent ? 0.85 : 1 }} className={accent ? '' : 'muted'}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </Card>
  );
}
