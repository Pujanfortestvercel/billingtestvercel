import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, TextField } from '../components/UI';
import { APP_NAME } from '../config/constants';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signIn(email, password);
    setLoading(false);
    if (res.error) setError(res.error);
    // On success, auth state changes and the app routes automatically.
  }

  return (
    <AuthShell title={APP_NAME} subtitle="Log in to continue">
      <form onSubmit={handleLogin}>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
        />
        {error ? (
          <div className="field-error" style={{ textAlign: 'center', marginBottom: 10 }}>
            {error}
          </div>
        ) : null}
        <Button title="Log In" type="submit" loading={loading} block />
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>
        New here? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create an account</Link>
      </p>
    </AuthShell>
  );
}
