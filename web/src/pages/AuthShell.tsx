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
    <div className="auth-container">
      {/* Mobile Top Header (only visible on mobile screens) */}
      <div className="auth-mobile-header">
        <img src="/logo.png" alt={APP_NAME} className="auth-mobile-logo" />
        <p className="auth-mobile-tagline">Invoicing & Business Management Made Simple</p>
      </div>

      {/* Marketing hero panel (desktop layout) */}
      <div className="auth-hero">
        <div style={{ marginBottom: 20 }}>
          <img src="/logo.png" alt={APP_NAME} style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
        </div>
        <h1 style={{ fontSize: 36, margin: '10px 0' }}>{APP_NAME}</h1>
        <p style={{ fontSize: 18, opacity: 0.92, maxWidth: 420, lineHeight: 1.6 }}>
          Create invoices in seconds. Track customers, items, and your full
          billing history — from any device, anywhere.
        </p>
        <ul style={{ marginTop: 22, lineHeight: 2, opacity: 0.92, fontSize: 16 }}>
          <li>⚡ Fast item & customer autocomplete</li>
          <li>🖨️ Print or save invoices as PDF</li>
          <li>💬 Share bills on WhatsApp</li>
          <li>🔒 Your data stays private to you</li>
        </ul>
      </div>

      {/* Form Container */}
      <div className="auth-form-wrapper">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <img src="/logo.png" alt={APP_NAME} className="auth-card-logo" />
            <h2 style={{ margin: 0, fontSize: 26, color: 'var(--text)' }}>{title}</h2>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>{subtitle}</p>
          </div>
          {children}
        </div>
      </div>

      <style>{`
        .auth-container {
          display: flex;
          min-height: 100vh;
          background: var(--bg);
        }
        .auth-hero {
          flex: 1.1;
          background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%);
          color: #fff;
          padding: 56px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .auth-mobile-header {
          display: none;
        }
        .auth-form-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .auth-form-card {
          width: 100%;
          max-width: 400px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 36px 30px;
          box-shadow: var(--shadow-md);
        }
        .auth-card-logo {
          display: none;
          max-height: 48px;
          margin: 0 auto 16px;
          object-fit: contain;
        }
        .auth-form-header {
          text-align: center;
          margin-bottom: 24px;
        }

        @media (max-width: 820px) {
          .auth-container {
            flex-direction: column;
            background: linear-gradient(180deg, #1e40af 0%, #1d4ed8 220px, var(--bg) 220px);
          }
          .auth-hero {
            display: none !important;
          }
          .auth-mobile-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 20px 24px;
            color: #fff;
            text-align: center;
          }
          .auth-mobile-logo {
            max-height: 52px;
            max-width: 260px;
            object-fit: contain;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.2));
          }
          .auth-mobile-tagline {
            margin: 8px 0 0;
            font-size: 13px;
            opacity: 0.9;
            font-weight: 500;
          }
          .auth-form-wrapper {
            padding: 0 16px 32px;
            align-items: flex-start;
          }
          .auth-form-card {
            box-shadow: var(--shadow-lg);
            padding: 28px 20px;
          }
          .auth-card-logo {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}
