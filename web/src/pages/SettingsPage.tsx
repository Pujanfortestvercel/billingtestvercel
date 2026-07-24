// ---------------------------------------------------------------------------
// SETTINGS — pick your store type (changes the billing form + invoice) and set
// your shop profile (name, logo, owner's phone, address) that prints on every
// invoice. Saved to the database, so it follows you across devices.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/Toast';
import { Button, Card, Spinner, TextField } from '../components/UI';
import { STORE_TYPE_LIST, type StoreType } from '../config/storeTypes';

// Downscale a picked image to a small data URL so it fits comfortably in the
// settings row and prints crisply on invoices.
function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 240;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const { settings, store, loading, save } = useSettings();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [storeType, setStoreType] = useState<StoreType>('grocery');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setStoreType((settings.store_type as StoreType) ?? 'grocery');
    setShopName(settings.shop_name ?? '');
    setPhone(settings.phone ?? '');
    setAddress(settings.address ?? '');
    setLogo(settings.logo_url ?? null);
  }, [settings]);

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLogo(await fileToLogoDataUrl(file));
    } catch {
      toast('Could not read that image.', 'error');
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({
        store_type: storeType,
        shop_name: shopName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logo,
      });
      toast('Settings saved ✅', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner text="Loading settings…" />;

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      {/* Store type */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Store type</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          This changes the fields on the billing form and the invoice layout.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 10,
          }}
        >
          {STORE_TYPE_LIST.map(s => {
            const active = s.key === storeType;
            return (
              <button
                key={s.key}
                onClick={() => setStoreType(s.key)}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  background: active ? 'var(--primary-soft)' : 'var(--surface)',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontSize: 22 }}>{s.emoji}</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{s.label}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {s.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Shop profile */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Shop profile</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          Shown on the header of every invoice you print or share.
        </p>

        <div className="row gap-md" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 96,
                height: 96,
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)',
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {logo ? (
                <img src={logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>+ Logo</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
            {logo ? (
              <button
                className="btn btn-ghost btn-sm"
                style={{ border: 'none', color: 'var(--danger)', marginTop: 6 }}
                onClick={() => setLogo(null)}
              >
                Remove
              </button>
            ) : null}
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <TextField
              label="Shop name"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              placeholder="e.g. Sharma General Store"
            />
            <TextField
              label="Owner's phone number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
            <div className="field">
              <label className="field-label">Address</label>
              <textarea
                className="input"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Shop address"
                rows={3}
                style={{ height: 'auto', padding: 12, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Button title="Save settings" loading={saving} onClick={onSave} />
      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        Current store type: <strong>{store.label}</strong> · App Version: <strong>v1.0.0</strong>
      </p>
    </div>
  );
}
