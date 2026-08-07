// ---------------------------------------------------------------------------
// PUBLIC DIGITAL STOREFRONT & ONLINE CATALOG PAGE (/store/:userId)
// ---------------------------------------------------------------------------
// Unlocked when shopkeepers add 40+ items! Customers can view items, search,
// see live inventory stock status, and place direct orders on WhatsApp!
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Item, Settings } from '../types/models';
import { formatCurrency } from '../utils/format';
import { Spinner, Card, Button } from '../components/UI';
import { getStoreConfig } from '../config/storeTypes';

type CartItem = {
  item: Item;
  qty: number;
};

export function PublicStorePage() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [shopSettings, setShopSettings] = useState<Settings | null>(null);
  const [itemList, setItemList] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [custName, setCustName] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    async function loadStoreData() {
      setLoading(true);
      try {
        // Fetch shop settings
        const { data: setRes } = await supabase
          .from('settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (setRes) setShopSettings(setRes as Settings);

        // Fetch shop items catalog
        const { data: itemRes } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', userId)
          .order('item_name', { ascending: true });

        if (itemRes) setItemList(itemRes as Item[]);
      } catch (e) {
        console.error('Error loading store data:', e);
      } finally {
        setLoading(false);
      }
    }

    loadStoreData();
  }, [userId]);

  function addToCart(it: Item) {
    setCart(prev => {
      const existing = prev[it.id]?.qty || 0;
      return {
        ...prev,
        [it.id]: { item: it, qty: existing + 1 },
      };
    });
  }

  function removeFromCart(itId: string) {
    setCart(prev => {
      const existing = prev[itId]?.qty || 0;
      if (existing <= 1) {
        const copy = { ...prev };
        delete copy[itId];
        return copy;
      }
      return {
        ...prev,
        [itId]: { ...prev[itId], qty: existing - 1 },
      };
    });
  }

  const store = getStoreConfig(shopSettings?.store_type);
  const shopName = shopSettings?.shop_name || 'Online Catalog Store';
  const phone = shopSettings?.phone || '';
  const address = shopSettings?.address || '';

  const filteredItems = itemList.filter(it =>
    it.item_name.toLowerCase().includes(search.toLowerCase()),
  );

  const cartList = Object.values(cart);
  const cartItemCount = cartList.reduce((sum, i) => sum + i.qty, 0);
  const cartTotal = cartList.reduce((sum, i) => sum + (i.item.default_rate ?? 0) * i.qty, 0);

  function sendWhatsAppOrder() {
    if (!phone) {
      alert('Store phone number is not available. Please contact shopkeeper directly.');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const itemLines = cartList
      .map(
        c => `• ${c.item.item_name} × ${c.qty} = ${formatCurrency((c.item.default_rate ?? 0) * c.qty)}`,
      )
      .join('\n');

    const msg = [
      `🛒 *NEW ORDER FOR ${shopName.toUpperCase()}*`,
      `----------------------------------------`,
      itemLines,
      `----------------------------------------`,
      `💰 *Total Amount:* ${formatCurrency(cartTotal)}`,
      custName.trim() ? `👤 *Customer Name:* ${custName.trim()}` : '',
      custAddress.trim() ? `📍 *Delivery Address:* ${custAddress.trim()}` : '',
      `----------------------------------------`,
      `Sent via BusinessSathi Online Catalog`,
    ]
      .filter(Boolean)
      .join('\n');

    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }

  if (loading) return <Spinner text="Loading shop catalog..." />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text)', paddingBottom: 100 }}>
      {/* Store Header */}
      <header
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {shopSettings?.logo_url ? (
            <img
              src={shopSettings.logo_url}
              alt="logo"
              style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--border)' }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: 'var(--primary-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              {store.emoji}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, margin: 0, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shopName}
            </h1>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {store.label} {phone ? `· 📞 ${phone}` : ''}
            </div>
            {address ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📍 {address}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Catalog Content */}
      <div style={{ maxWidth: 800, margin: '20px auto', padding: '0 16px' }}>
        {/* Search Bar */}
        <div style={{ marginBottom: 18 }}>
          <input
            className="input"
            type="text"
            placeholder="🔍 Search items or products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', fontSize: 15, padding: '12px 16px', borderRadius: 'var(--radius-md)' }}
          />
        </div>

        {/* Item Count Subtitle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <strong style={{ fontSize: 16 }}>Available Products ({filteredItems.length})</strong>
          <span className="badge badge-success">Live Stock</span>
        </div>

        {/* Product List Grid */}
        {filteredItems.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>No items found</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {search ? 'Try searching for another product name.' : 'This store has no products listed yet.'}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {filteredItems.map(it => {
              const inCartQty = cart[it.id]?.qty || 0;
              const hasStock = (it.stock_qty ?? 0) > 0;
              const price = it.default_rate ?? 0;

              return (
                <Card
                  key={it.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 16,
                    position: 'relative',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{it.item_name}</div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                        {formatCurrency(price)}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: hasStock ? 'var(--success-soft)' : 'var(--danger-soft)',
                          color: hasStock ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {hasStock ? `${it.stock_qty} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    {inCartQty === 0 ? (
                      <Button
                        title="+ Add to Order"
                        variant="primary"
                        block
                        disabled={!hasStock}
                        onClick={() => addToCart(it)}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--primary-soft)',
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          padding: '4px 8px',
                        }}
                      >
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => removeFromCart(it.id)}
                          style={{ width: 32, height: 32, padding: 0, fontWeight: 800 }}
                        >
                          -
                        </button>
                        <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>{inCartQty}</span>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => addToCart(it)}
                          style={{ width: 32, height: 32, padding: 0, fontWeight: 800 }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cartItemCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--surface)',
            borderTop: '2px solid var(--primary)',
            padding: '14px 20px',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
            zIndex: 100,
          }}
        >
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {cartItemCount} item{cartItemCount === 1 ? '' : 's'} selected
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>
                {formatCurrency(cartTotal)}
              </div>
            </div>

            <Button
              title="💬 Order via WhatsApp →"
              variant="primary"
              onClick={() => setOrderModalOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Order Details Confirmation Popup */}
      {orderModalOpen && (
        <div
          onClick={() => setOrderModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
            <Card style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Complete Your Order</h3>
            <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>
              Enter your details to send this order directly to <strong>{shopName}</strong> on WhatsApp.
            </p>

            <div style={{ margin: '14px 0', background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Order Summary ({cartItemCount} items):</div>
              {cartList.map(c => (
                <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span>{c.item.item_name} × {c.qty}</span>
                  <strong>{formatCurrency((c.item.default_rate ?? 0) * c.qty)}</strong>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800 }}>
                <span>Total:</span>
                <span style={{ color: 'var(--primary)' }}>{formatCurrency(cartTotal)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Your Name</label>
              <input
                className="input"
                placeholder="Enter your full name"
                value={custName}
                onChange={e => setCustName(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Delivery Address / Notes</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Enter your address or special instructions"
                value={custAddress}
                onChange={e => setCustAddress(e.target.value)}
                style={{ height: 'auto', padding: 8 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button title="Cancel" variant="ghost" onClick={() => setOrderModalOpen(false)} />
              <Button title="📱 Send Order on WhatsApp" variant="primary" block onClick={sendWhatsAppOrder} />
            </div>
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}
