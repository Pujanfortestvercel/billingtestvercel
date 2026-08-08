// ---------------------------------------------------------------------------
// ONLINE ORDERS PAGE (FOR SHOPKEEPER)
// ---------------------------------------------------------------------------
// Shows incoming orders placed by customers through the public storefront!
// Orders marked COMPLETED automatically self-delete after 5 minutes!
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Button, Card, Spinner, EmptyState } from '../components/UI';
import {
  fetchOnlineOrders,
  updateOrderStatus,
  deleteOnlineOrder,
  deductInventoryForOrder,
  type OnlineOrder,
} from '../services/onlineOrderService';
import { formatCurrency, formatDateTime } from '../utils/format';

export function OnlineOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchOnlineOrders(user.id);
      setOrders(data);
    } catch (e: any) {
      toast(e?.message || 'Could not load online orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();

    // Auto refresh every 15 seconds to purge expired orders live!
    const timer = setInterval(() => {
      loadOrders();
    }, 15000);

    return () => clearInterval(timer);
  }, [user]);

  async function handleStatusUpdate(orderId: string, status: 'pending' | 'accepted' | 'completed') {
    try {
      await updateOrderStatus(orderId, status);

      // Deduct inventory when order is accepted
      if (status === 'accepted') {
        const order = orders.find(o => o.id === orderId);
        if (order && order.items.length > 0) {
          await deductInventoryForOrder(
            order.items.map(i => ({ item_id: i.item_id, qty: i.qty })),
          );
          toast('Order accepted! Inventory updated automatically. ✅📦', 'success');
        } else {
          toast('Order accepted! ✅', 'success');
        }
      } else if (status === 'completed') {
        toast('Order marked completed! It will auto-delete in 5 minutes. 🎉', 'success');
      } else {
        toast(`Order status updated to ${status} ✅`, 'success');
      }
      loadOrders();
    } catch (e: any) {
      toast(e?.message || 'Could not update status.', 'error');
    }
  }

  async function handleDelete(orderId: string) {
    try {
      await deleteOnlineOrder(orderId);
      toast('Order deleted.', 'success');
      loadOrders();
    } catch (e: any) {
      toast(e?.message || 'Could not delete order.', 'error');
    }
  }

  async function handleConvertToBill(ord: OnlineOrder) {
    // Deduct inventory for the order items
    if (ord.items.length > 0) {
      await deductInventoryForOrder(
        ord.items.map(i => ({ item_id: i.item_id, qty: i.qty })),
      );
    }
    // Mark order completed & navigate to billing
    updateOrderStatus(ord.id, 'completed');
    navigate('/billing', {
      state: {
        customerName: ord.customer_name,
        notes: `Online Order ${ord.order_number}`,
        patientAddress: ord.customer_address,
        items: ord.items.map(i => ({
          name: i.item_name,
          rate: i.rate,
          qty: i.qty,
        })),
      },
    });
  }

  function getRemainingMins(completedAt?: string): number {
    if (!completedAt) return 5;
    const elapsedMs = Date.now() - new Date(completedAt).getTime();
    const remainingMs = 5 * 60 * 1000 - elapsedMs;
    return Math.max(1, Math.ceil(remainingMs / 60000));
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>🛍️ Online Orders</h1>
          <p className="muted" style={{ margin: 0, marginTop: 2 }}>
            Customer orders placed through your public store catalog. Completed orders auto-delete in 5 minutes!
          </p>
        </div>
        <Button title="🔄 Refresh Orders" variant="ghost" onClick={loadOrders} />
      </div>

      {loading ? (
        <Spinner text="Loading incoming orders..." />
      ) : orders.length === 0 ? (
        <EmptyState
          emoji="🛍️"
          title="No pending online orders"
          subtitle="When customers order from your public store link, their orders will appear here automatically."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map(ord => {
            const isCompleted = ord.status === 'completed';
            const minsLeft = isCompleted ? getRemainingMins(ord.completed_at) : 5;

            return (
              <Card
                key={ord.id}
                style={{
                  padding: 18,
                  opacity: isCompleted ? 0.85 : 1,
                  borderLeft: isCompleted ? '4px solid var(--success)' : '4px solid var(--primary)',
                }}
              >
                <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 17, color: 'var(--primary)' }}>{ord.order_number}</strong>
                      <span
                        className={`badge ${
                          isCompleted
                            ? 'badge-success'
                            : ord.status === 'accepted'
                            ? 'badge-primary'
                            : 'badge-warning'
                        }`}
                      >
                        {isCompleted
                          ? `COMPLETED (Auto-deletes in ${minsLeft}m)`
                          : ord.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      📅 {formatDateTime(ord.created_at)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>
                      {formatCurrency(ord.total_amount)}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {ord.items.length} item{ord.items.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>

                {/* Customer Details Box */}
                <div style={{ margin: '12px 0', background: 'var(--surface-2)', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                  <div><strong>Customer:</strong> {ord.customer_name} {ord.customer_phone ? `· 📞 ${ord.customer_phone}` : ''}</div>
                  {ord.customer_address ? <div style={{ marginTop: 2 }}><strong>Delivery Address:</strong> 📍 {ord.customer_address}</div> : null}
                </div>

                {/* Ordered Items Table */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>ORDERED ITEMS:</div>
                  {ord.items.map((it, idx) => (
                    <div key={idx} className="row spread" style={{ fontSize: 13, padding: '3px 0' }}>
                      <span>{it.item_name} × <strong>{it.qty}</strong></span>
                      <span>{formatCurrency(it.total)}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                  <Button
                    title="🧾 Convert to Official Bill"
                    variant="primary"
                    small
                    onClick={() => handleConvertToBill(ord)}
                  />
                  {ord.status === 'pending' && (
                    <Button
                      title="✅ Accept Order"
                      variant="secondary"
                      small
                      onClick={() => handleStatusUpdate(ord.id, 'accepted')}
                    />
                  )}
                  {!isCompleted && (
                    <Button
                      title="🎉 Mark Completed"
                      variant="ghost"
                      small
                      onClick={() => handleStatusUpdate(ord.id, 'completed')}
                    />
                  )}
                  <Button
                    title="🗑 Delete Now"
                    variant="danger"
                    small
                    onClick={() => handleDelete(ord.id)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
