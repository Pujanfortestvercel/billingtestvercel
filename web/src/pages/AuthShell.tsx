// A centered card with a split marketing panel — shared by Login & Signup.
import { APP_NAME } from '../config/constants';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Marketing panel (hidden on small screens) */}
      <div
        className="auth-hero"
        style={{
          flex: 1,
          background:
            'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
          color: '#fff',
          padding: 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 56 }}>🧾</div>
        <h1 style={{ fontSize: 36, margin: '18px 0 10px' }}>{APP_NAME}</h1>
        <p style={{ fontSize: 18, opacity: 0.92, maxWidth: 420, lineHeight: 1.6 }}>
          Create invoices in seconds. Track customers, items, and your full
          billing history — from any device, in your browser.
        </p>
        <ul style={{ marginTop: 22, lineHeight: 2, opacity: 0.92, fontSize: 16 }}>
          <li>⚡ Fast item & customer autocomplete</li>
          <li>🖨️ Print or save invoices as PDF</li>
          <li>💬 Share bills on WhatsApp</li>
          <li>🔒 Your data stays private to you</li>
        </ul>
      </div>

      {/* Form */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 26 }}>{title}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{subtitle}</p>
          </div>
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) { .auth-hero { display: none !important; } }
      `}</style>
    </div>
  );
}
