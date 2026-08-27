// ---------------------------------------------------------------------------
// ADMIN — the app owner's control panel. Lists every BUSINESS account that
// registered. For each one the admin can:
//   • assign a PLAN (21-day trial / 1m / 3m / 6m / 1y / permanent),
//   • Freeze (suspend access),
//   • Delete the account permanently (cascades all their data).
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Spinner } from '../components/UI';
import {
  listAllUsers,
  freezeUser,
  setSubscriptionPlan,
  deleteUserAccount,
  type AdminUserRow,
} from '../services/adminService';
import {
  computeStatus,
  planLabel,
  PLANS,
  type PlanKey,
  getPendingSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
} from '../services/subscriptionService';
import { formatDate } from '../utils/format';
import { APP_NAME } from '../config/constants';

export function AdminPage() {
  const { user, signOut } = useAuth();
  const { toast, confirm } = useToast();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await listAllUsers());
      setPendingRequests(await getPendingSubscriptionRequests());
    } catch (e: any) {
      toast(e?.message ?? 'Could not load accounts.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<void>, msg: string) {
    try {
      await action();
      await load();
      toast(msg, 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not update.', 'error');
    }
  }

  async function handleApproveRequest(req: any) {
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      await approveSubscriptionRequest(req.id, req.user_id, req.plan_key);
      await load();
      toast(`Approved ${req.user_email} for ${planLabel(req.plan_key)} ✅`, 'success');
    } catch (e: any) {
      await load();
      toast(e?.message ?? 'Could not approve request.', 'error');
    }
  }

  async function handleRejectRequest(reqId: string) {
    setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    try {
      await rejectSubscriptionRequest(reqId);
      await load();
      toast('Subscription request rejected.', 'success');
    } catch (e: any) {
      await load();
      toast(e?.message ?? 'Could not reject request.', 'error');
    }
  }

  async function removeAccount(row: AdminUserRow) {
    const ok = await confirm(
      'Delete account permanently?',
      `This will permanently delete ${row.email ?? 'this account'} and ALL of their ` +
        `data — customers, items, and bills. This cannot be undone.`,
      { danger: true },
    );
    if (!ok) return;
    try {
      await deleteUserAccount(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
      toast('Account deleted permanently.', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not delete the account.', 'error');
    }
  }

  const visible = rows.filter(r => r.role !== 'admin');

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 22px' }}>
      <div className="row spread" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0 }}>🛠️ {APP_NAME} Admin</h1>
        <Button title="Log out" variant="danger" small onClick={signOut} />
      </div>
      <p className="muted">
        Manage business accounts, approve subscription payment requests, or suspend access. Admin: {user?.email}
      </p>

      {/* Pending Subscription Payment Requests */}
      {pendingRequests.length > 0 ? (
        <Card style={{ marginBottom: 24, borderColor: 'var(--primary)', background: 'var(--primary-soft)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--primary)', marginBottom: 8 }}>
            🔔 Pending Subscription Requests ({pendingRequests.length})
          </h3>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>
            Shopkeepers who tapped "I Have Paid" for a plan upgrade. Check your UPI app and click Approve.
          </p>
          {pendingRequests.map(req => (
            <div
              key={req.id}
              className="row spread"
              style={{
                background: 'var(--surface)',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <strong style={{ fontSize: 15 }}>{req.user_email}</strong>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  Requested Plan: <strong style={{ color: 'var(--primary)' }}>{planLabel(req.plan_key)} (₹{req.amount})</strong>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  Requested on {formatDate(req.created_at)}
                </div>
              </div>
              <div className="row gap-sm">
                <Button
                  title="Approve ✅"
                  small
                  onClick={() => handleApproveRequest(req)}
                />
                <Button
                  title="Reject ❌"
                  variant="danger"
                  small
                  onClick={() => handleRejectRequest(req.id)}
                />
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState emoji="🧑‍💼" title="No accounts yet" subtitle="When a business registers, they'll appear here." />
      ) : (
        visible.map(item => (
          <AdminRow
            key={item.id}
            row={item}
            onApplyPlan={(plan, label) =>
              run(() => setSubscriptionPlan(item.id, plan), `Plan set: ${label}`)
            }
            onFreeze={() => run(() => freezeUser(item.id), 'Account suspended.')}
            onDelete={() => removeAccount(item)}
          />
        ))
      )}
    </div>
  );
}

function AdminRow({
  row,
  onApplyPlan,
  onFreeze,
  onDelete,
}: {
  row: AdminUserRow;
  onApplyPlan: (plan: PlanKey, label: string) => void;
  onFreeze: () => void;
  onDelete: () => void;
}) {
  const { status, daysLeft } = computeStatus(row.subscription);
  const [plan, setPlan] = useState<PlanKey>(
    PLANS.some(p => p.key === row.subscription?.plan)
      ? (row.subscription!.plan as PlanKey)
      : 'trial',
  );

  const badge =
    status === 'frozen' ? (
      <span className="badge badge-danger">Frozen</span>
    ) : status === 'trial' ? (
      <span className="badge badge-success">Trial · {daysLeft}d left</span>
    ) : status === 'active' ? (
      daysLeft === -1 ? (
        <span className="badge badge-success">Permanent</span>
      ) : (
        <span className="badge badge-success">Active · {daysLeft}d left</span>
      )
    ) : (
      <span className="badge badge-warning">Expired</span>
    );

  const end = row.subscription?.trial_end;

  return (
    <Card>
      <div className="row spread" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 200 }}>
          <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
            <strong>{row.email ?? '(no email)'}</strong>
            {badge}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Joined {formatDate(row.created_at)} · Plan: {planLabel(row.subscription?.plan)}
            {status !== 'frozen' && status !== 'expired' && daysLeft !== -1 && end
              ? ` · ends ${formatDate(end)}`
              : ''}
          </div>
        </div>

        <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
          <select
            className="input"
            value={plan}
            onChange={e => setPlan(e.target.value as PlanKey)}
            style={{ height: 36, width: 'auto', padding: '0 10px' }}
          >
            {PLANS.map(p => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <Button
            title="Apply"
            small
            onClick={() => {
              const p = PLANS.find(p => p.key === plan);
              if (p) onApplyPlan(plan, p.label);
            }}
          />
          <Button title="Freeze" variant="danger" small onClick={onFreeze} />
          <Button title="🗑 Delete" variant="danger" small onClick={onDelete} />
        </div>
      </div>
    </Card>
  );
}
