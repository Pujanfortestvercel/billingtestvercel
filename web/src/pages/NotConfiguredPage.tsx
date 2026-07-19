import { Card } from '../components/UI';

export function NotConfiguredPage() {
  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 56 }}>🔌</div>
        <h1>Connect your backend</h1>
        <p className="muted">
          The web app is built and ready — it just needs your free Supabase
          project credentials.
        </p>
      </div>
      <Card>
        <ol style={{ lineHeight: 2, margin: 0, paddingLeft: 18 }}>
          <li>Follow the guide in <code>SUPABASE_SETUP.md</code></li>
          <li>Run <code>supabase/schema.sql</code> in Supabase</li>
          <li>
            Paste your Project URL + anon key into{' '}
            <code>web/src/config/supabase.ts</code>
          </li>
          <li>Save — the app reloads into Login.</li>
        </ol>
      </Card>
    </div>
  );
}
