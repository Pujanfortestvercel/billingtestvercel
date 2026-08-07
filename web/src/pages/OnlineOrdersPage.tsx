// ---------------------------------------------------------------------------
// ONLINE ORDERS PAGE (FOR SHOPKEEPER)
// ---------------------------------------------------------------------------
// Shows incoming orders placed by customers through the public storefront!
// Shopkeepers can view customer details, items ordered, update order status,
// and convert online customer orders into official bills in 1 tap!
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Button, Card, Spinner, EmptyState } from '../components/UI';
import {
  fetchOnlineOrders,
  updateOrderStatus,
  type OnlineOrder,
} from '../services/onlineOrderService';
import { formatCurrency, formatDateTime } from '../utils/format';

export function OnlineOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchOnlineOrders(user.id);
      setOrders(data);
    } catch (e: any) {
      toast(e?.message || 'Could not load online orders.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [user]);

  async function handleStatusUpdate(orderId: string, status: 'pending' | 'accepted' | 'completed') {
    try {
      await updateOrderStatus(orderId, status);
      toast(`Order status updated to ${status} ✅`, 'success');
      loadOrders();
    } catch (e: any) {
      toast(e?.message || 'Could not update status.', 'error');
    }
  }

  function handleConvertToBill(ord: OnlineOrder) {
    // Navigate to billing page with pre-filled state
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

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>🛍️ Online Orders</h1>
          <p className="muted" style={{ margin: 0, marginTop: 2 }}>
            Customer orders placed through your public online storefront catalog.
          </p>
        </div>
        <Button title="🔄 Refresh Orders" variant="ghost" onClick={loadOrders} />
      </div>

      {loading ? (
        <Spinner text="Loading incoming orders..." />
      ) : orders.length === 0 ? (
        <EmptyState
          emoji="🛍️"
          title="No online orders yet"
          subtitle="When customers order from your public store link, their orders will appear here automatically."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map(ord => (
            <Card key={ord.id} style={{ padding: 18 }}>
              <div className="row spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 17, color: 'var(--primary)' }}>{ord.order_number}</strong>
                    <span
                      className={`badge ${
                        ord.status === 'completed'
                          ? 'badge-success'
                          : ord.status === 'accepted'
                          ? 'badge-primary'
                          : 'badge-warning'
                      }`}
                    >
                      {ord.status.toUpperCase()}
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
                {ord.status !== 'completed' && (
                  <Button
                    title="🎉 Mark Completed"
                    variant="ghost"
                    small
                    onClick={() => handleStatusUpdate(ord.id, 'completed')}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
