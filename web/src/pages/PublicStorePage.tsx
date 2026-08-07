// ---------------------------------------------------------------------------
// PUBLIC DIGITAL STOREFRONT & ONLINE CATALOG PAGE (/store/:userId)
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Item, Settings } from '../types/models';
import { formatCurrency } from '../utils/format';
import { Spinner, Card, Button } from '../components/UI';
import { getStoreConfig } from '../config/storeTypes';
import { createOnlineOrder, type OnlineOrder } from '../services/onlineOrderService';
import html2pdf from 'html2pdf.js';

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
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OnlineOrder | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    if (!userId) return;

    async function loadStoreData() {
      setLoading(true);
      try {
        // Fetch shop settings (store name, logo, address, phone)
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

  async function handleConfirmOrder() {
    if (!custName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!userId) return;

    setSubmittingOrder(true);
    try {
      const formattedItems = cartList.map(c => ({
        item_id: c.item.id,
        item_name: c.item.item_name,
        qty: c.qty,
        rate: c.item.default_rate ?? 0,
        total: (c.item.default_rate ?? 0) * c.qty,
      }));

      const created = await createOnlineOrder({
        userId,
        customerName: custName.trim(),
        customerPhone: custPhone.trim(),
        customerAddress: custAddress.trim(),
        items: formattedItems,
        totalAmount: cartTotal,
      });

      setPlacedOrder(created);
      setOrderModalOpen(false);
      setCart({});
    } catch (e: any) {
      alert('Error creating order: ' + (e?.message || 'Please try again'));
    } finally {
      setSubmittingOrder(false);
    }
  }

  function sendWhatsAppForOrder(ord: OnlineOrder) {
    if (!phone) {
      alert('Store phone number is not set.');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const itemLines = ord.items
      .map(c => `• ${c.item_name} × ${c.qty} = ${formatCurrency(c.total)}`)
      .join('\n');

    const msg = [
      `🛒 *ORDER ${ord.order_number} FOR ${shopName.toUpperCase()}*`,
      `----------------------------------------`,
      itemLines,
      `----------------------------------------`,
      `💰 *Total Amount:* ${formatCurrency(ord.total_amount)}`,
      `👤 *Customer Name:* ${ord.customer_name}`,
      ord.customer_phone ? `📞 *Customer Phone:* ${ord.customer_phone}` : '',
      ord.customer_address ? `📍 *Address:* ${ord.customer_address}` : '',
      `----------------------------------------`,
      `Sent via BusinessSathi Online Storefront`,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function downloadCustomerInvoicePdf(ord: OnlineOrder) {
    const itemRows = ord.items
      .map(
        i => `<tr>
          <td>${i.item_name}</td>
          <td style="text-align:right">${i.qty}</td>
          <td style="text-align:right">${formatCurrency(i.rate)}</td>
          <td style="text-align:right">${formatCurrency(i.total)}</td>
        </tr>`,
      )
      .join('');

    const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice ${ord.order_number}</title>
        <style>
          body { font-family: sans-serif; color: #111827; padding: 20px; max-width: 700px; margin: 0 auto; }
          h1 { color: #2563EB; margin: 0; font-size: 22px; }
          .muted { color: #6B7280; font-size: 13px; }
          .head { display: flex; justify-content: space-between; border-bottom: 2px solid #2563EB; padding-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #E5E7EB; }
          th { background: #F3F4F6; }
          .grand { font-size: 16px; font-weight: bold; border-top: 2px solid #111827; }
        </style>
      </head>
      <body>
        <div class="head">
          <div>
            <h1>${shopName}</h1>
            ${phone ? `<div class="muted">Phone: ${phone}</div>` : ''}
            ${address ? `<div class="muted">Address: ${address}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-size:16px; font-weight:bold">${ord.order_number}</div>
            <div class="muted">Date: ${new Date(ord.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div style="margin-top:14px; background:#F9FAFB; padding:10px; border-radius:6px; font-size:13px">
          <div><strong>Billed To:</strong> ${ord.customer_name}</div>
          ${ord.customer_phone ? `<div><strong>Phone:</strong> ${ord.customer_phone}</div>` : ''}
          ${ord.customer_address ? `<div><strong>Address:</strong> ${ord.customer_address}</div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:right">Qty</th>
              <th style="text-align:right">Rate</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr class="grand">
              <td colspan="3">Grand Total</td>
              <td style="text-align:right; color:#2563EB">${formatCurrency(ord.total_amount)}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top:30px; display:flex; justify-content:space-between; align-items:flex-end;">
          <div style="font-size:11px; color:#6B7280">
            <div>Thank you for your order!</div>
            <div>Computer Generated Invoice</div>
          </div>
          <div style="text-align:center; width:180px">
            <div style="height:40px; border-bottom:1px dashed #6B7280"></div>
            <div style="font-size:12px; font-weight:bold; margin-top:4px">Authorized Signatory</div>
            <div style="font-size:11px; color:#6B7280">For ${shopName}</div>
          </div>
        </div>
      </body>
    </html>`;

    html2pdf()
      .set({
        margin: 10,
        filename: `${ord.order_number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(html)
      .save();
  }

  if (loading) return <Spinner text="Loading shop catalog..." />;

  // Render Placed Order Confirmation View if Order complete!
  if (placedOrder) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text)', padding: '40px 16px', display: 'flex', justifyContent: 'center' }}>
        <Card style={{ maxWidth: 500, width: '100%', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 50, marginBottom: 10 }}>🎉</div>
          <h2 style={{ margin: 0, color: 'var(--primary)' }}>Order Placed Successfully!</h2>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Thank you for ordering from <strong>{shopName}</strong>
          </div>

          <div style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary)', padding: '12px 16px', borderRadius: 8, margin: '20px 0', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Order Number:</span>
              <strong style={{ fontSize: 16, color: 'var(--primary)' }}>{placedOrder.order_number}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Customer Name:</span>
              <strong>{placedOrder.customer_name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Total Amount:</span>
              <strong style={{ fontSize: 17, color: 'var(--primary)' }}>{formatCurrency(placedOrder.total_amount)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button
              title="📄 Download Tax Invoice PDF"
              variant="secondary"
              block
              onClick={() => downloadCustomerInvoicePdf(placedOrder)}
            />
            <Button
              title="💬 Send Order to Shopkeeper on WhatsApp"
              variant="primary"
              block
              onClick={() => sendWhatsAppForOrder(placedOrder)}
            />
            <Button
              title="← Return to Shop Catalog"
              variant="ghost"
              block
              onClick={() => setPlacedOrder(null)}
            />
          </div>
        </Card>
      </div>
    );
  }

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
              title="Checkout & Order →"
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
              <h3 style={{ marginTop: 0 }}>Checkout Order</h3>
              <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>
                Enter your details to complete your order with <strong>{shopName}</strong>.
              </p>

              <div style={{ margin: '14px 0', background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Order Items ({cartItemCount}):</div>
                {cartList.map(c => (
                  <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span>{c.item.item_name} × {c.qty}</span>
                    <strong>{formatCurrency((c.item.default_rate ?? 0) * c.qty)}</strong>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800 }}>
                  <span>Total Amount:</span>
                  <span style={{ color: 'var(--primary)' }}>{formatCurrency(cartTotal)}</span>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label className="field-label">Your Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Rahul Sharma"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label className="field-label">Your Phone Number</label>
                <input
                  className="input"
                  placeholder="e.g. 9876543210"
                  value={custPhone}
                  onChange={e => setCustPhone(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="field-label">Delivery Address</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Enter your shop/home delivery address"
                  value={custAddress}
                  onChange={e => setCustAddress(e.target.value)}
                  style={{ height: 'auto', padding: 8 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Button title="Cancel" variant="ghost" onClick={() => setOrderModalOpen(false)} />
                <Button title="✅ Submit Order" variant="primary" block loading={submittingOrder} onClick={handleConfirmOrder} />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
