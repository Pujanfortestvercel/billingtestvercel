// ---------------------------------------------------------------------------
// TOAST + CONFIRM — replaces React Native's Alert.alert on the web.
//   const { toast, confirm } = useToast();
//   toast('Saved ✅');                          // transient message
//   if (await confirm('Delete?', 'Sure?')) {…}  // promise-based confirm
// ---------------------------------------------------------------------------
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Button } from './UI';

type ToastKind = 'info' | 'success' | 'error';
type ToastItem = { id: number; message: string; kind: ToastKind };
type ConfirmState = {
  title: string;
  message?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
};

type ToastApi = {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (
    title: string,
    message?: string,
    opts?: { danger?: boolean },
  ) => Promise<boolean>;
};

const Ctx = createContext<ToastApi | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const idRef = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = idRef.current++;
    setItems(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const confirm = useCallback(
    (title: string, message?: string, opts?: { danger?: boolean }) =>
      new Promise<boolean>(resolve => {
        setConfirmState({ title, message, danger: opts?.danger, resolve });
      }),
    [],
  );

  function closeConfirm(value: boolean) {
    confirmState?.resolve(value);
    setConfirmState(null);
  }

  const kindColor: Record<ToastKind, string> = {
    info: 'var(--primary)',
    success: 'var(--success)',
    error: 'var(--danger)',
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 200,
          maxWidth: 360,
        }}
      >
        {items.map(t => (
          <div
            key={t.id}
            className="card page-enter"
            style={{
              borderLeft: `4px solid ${kindColor[t.kind]}`,
              boxShadow: 'var(--shadow-lg)',
              padding: '12px 16px',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmState ? (
        <div
          onClick={() => closeConfirm(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 300,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card page-enter"
            style={{ width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-lg)' }}
          >
            <h3 style={{ marginTop: 0 }}>{confirmState.title}</h3>
            {confirmState.message ? (
              <p className="muted" style={{ whiteSpace: 'pre-line' }}>
                {confirmState.message}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Button
                title="Cancel"
                variant="ghost"
                block
                onClick={() => closeConfirm(false)}
              />
              <Button
                title="Confirm"
                variant={confirmState.danger ? 'danger' : 'primary'}
                block
                onClick={() => closeConfirm(true)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
