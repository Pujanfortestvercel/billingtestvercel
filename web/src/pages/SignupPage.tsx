import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Button, TextField } from '../components/UI';
import { APP_NAME, TRIAL_DAYS } from '../config/constants';
import { STORE_TYPE_LIST, type StoreType } from '../config/storeTypes';
import { rememberPendingStoreType } from '../context/SettingsContext';
import { AuthShell } from './AuthShell';

export function SignupPage() {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('grocery');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signUp(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    // Apply this store type when the account's settings row is first created.
    rememberPendingStoreType(storeType);
    toast('Account created 🎉 You can now log in.', 'success');
    navigate('/login');
  }

  return (
    <AuthShell
      title={`Create your ${APP_NAME}`}
      subtitle={`${TRIAL_DAYS} days free — no card needed`}
    >
      <form onSubmit={handleSignup}>
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
          placeholder="At least 6 characters"
          autoComplete="new-password"
        />
        <TextField
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-type your password"
          autoComplete="new-password"
        />
        <div className="field">
          <label className="field-label">What kind of store do you run?</label>
          <select
            className="input"
            value={storeType}
            onChange={e => setStoreType(e.target.value as StoreType)}
          >
            {STORE_TYPE_LIST.map(s => (
              <option key={s.key} value={s.key}>
                {s.emoji}  {s.label}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <div className="field-error" style={{ textAlign: 'center', marginBottom: 10 }}>
            {error}
          </div>
        ) : null}
        <Button title="Create Account" type="submit" loading={loading} block />
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
