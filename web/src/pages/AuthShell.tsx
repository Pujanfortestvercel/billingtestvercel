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
        <div className="auth-mobile-logo-box">
          <img src="/logo.png" alt={APP_NAME} className="auth-mobile-logo" />
        </div>
        <p className="auth-mobile-tagline">Invoicing & Business Management Made Simple</p>
      </div>

      {/* Marketing hero panel (desktop layout) */}
      <div className="auth-hero">
        <div className="hero-logo-box">
          <img src="/logo.png" alt={APP_NAME} style={{ width: '100%', height: 'auto', maxHeight: 110, objectFit: 'contain' }} />
        </div>
        <p style={{ fontSize: 19, opacity: 0.95, maxWidth: 460, lineHeight: 1.6, marginTop: 28, fontWeight: 500 }}>
          Create invoices in seconds. Track customers, items, and your full
          billing history — from any device, anywhere.
        </p>
        <ul style={{ marginTop: 24, lineHeight: 2.2, opacity: 0.95, fontSize: 16, paddingLeft: 20 }}>
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
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0, fontSize: 14 }}>{subtitle}</p>
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
          background: linear-gradient(135deg, #0f2b5c 0%, #1e40af 50%, #2563eb 100%);
          color: #fff;
          padding: 56px 64px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .hero-logo-box {
          background: #ffffff;
          padding: 20px 36px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
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
          max-width: 440px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 40px 34px;
          box-shadow: var(--shadow-md);
        }
        .auth-card-logo {
          display: block;
          max-width: 320px;
          width: 100%;
          height: auto;
          max-height: 88px;
          margin: 0 auto 22px;
          object-fit: contain;
        }
        .auth-form-header {
          text-align: center;
          margin-bottom: 24px;
        }

        @media (max-width: 820px) {
          .auth-container {
            flex-direction: column;
            background: linear-gradient(180deg, #0f2b5c 0%, #1d4ed8 240px, var(--bg) 240px);
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
          .auth-mobile-logo-box {
            background: #ffffff;
            padding: 14px 28px;
            border-radius: 16px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.18);
            display: inline-flex;
            max-width: 320px;
            width: 100%;
          }
          .auth-mobile-logo {
            max-height: 76px;
            max-width: 280px;
            width: 100%;
            height: auto;
            object-fit: contain;
          }
          .auth-mobile-tagline {
            margin: 12px 0 0;
            font-size: 13px;
            opacity: 0.92;
            font-weight: 500;
          }
          .auth-form-wrapper {
            padding: 0 16px 32px;
            align-items: flex-start;
          }
          .auth-form-card {
            box-shadow: var(--shadow-lg);
            padding: 30px 24px;
          }
        }
      `}</style>
    </div>
  );
}
