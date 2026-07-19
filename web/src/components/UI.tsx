// ---------------------------------------------------------------------------
// SHARED UI PRIMITIVES — Button, Card, TextField, Spinner, EmptyState, Modal.
// Web equivalents of the original app's src/components/common/* pieces.
// ---------------------------------------------------------------------------
import React, { useEffect } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  type = 'button',
  className = '',
  block,
  small,
}: {
  title: React.ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  block?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${
        small ? 'btn-sm' : ''
      } ${className}`}
    >
      {loading ? <span className="spin" style={{ width: 18, height: 18 }} /> : title}
    </button>
  );
}

export function Card({
  children,
  onClick,
  style,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </div>
  );
}

export function TextField({
  label,
  error,
  ...rest
}: {
  label?: string;
  error?: string | null;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      {label ? <label className="field-label">{label}</label> : null}
      <input className={`input ${error ? 'error' : ''}`} {...rest} />
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}

export function Spinner({ text }: { text?: string }) {
  return (
    <div className="center-screen">
      <span className="spin" style={{ width: 32, height: 32 }} />
      {text ? <span className="muted">{text}</span> : null}
    </div>
  );
}

export function EmptyState({
  emoji = '📭',
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '56px 20px',
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>
      <h3 style={{ margin: 0, fontSize: 19 }}>{title}</h3>
      {subtitle ? (
        <p className="muted" style={{ marginTop: 6, maxWidth: 360 }}>
          {subtitle}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <div style={{ marginTop: 18 }}>
          <Button title={actionLabel} onClick={onAction} />
        </div>
      ) : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card page-enter"
        style={{ width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)' }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
