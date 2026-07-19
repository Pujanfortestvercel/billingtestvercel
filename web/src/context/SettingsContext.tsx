// ---------------------------------------------------------------------------
// SETTINGS CONTEXT — loads the logged-in user's store type + shop profile once
// and shares it with every page (billing form, invoices, sidebar). Creates the
// row on first load, honouring a store type the user picked at signup (stashed
// in localStorage). Call `save()` to persist changes.
// ---------------------------------------------------------------------------
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import type { Settings } from '../types/models';
import {
  ensureSettings,
  getSettings,
  saveSettings,
} from '../services/settingsService';
import { getStoreConfig, type StoreTypeConfig } from '../config/storeTypes';
import { applyBranding } from '../utils/branding';

const PENDING_STORE_KEY = 'pending_store_type';

type SettingsContextValue = {
  settings: Settings | null;
  store: StoreTypeConfig;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (patch: Partial<Omit<Settings, 'user_id'>>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const s = await getSettings(user.id);
    setSettings(s);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    const pending = localStorage.getItem(PENDING_STORE_KEY) || 'grocery';
    ensureSettings(user.id, pending)
      .then(s => {
        if (!active) return;
        setSettings(s);
        localStorage.removeItem(PENDING_STORE_KEY);
      })
      .catch(() => active && setSettings(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  // Keep the browser tab + installable home-screen icon/name in sync with the
  // shop's saved logo + name (per-user branding).
  useEffect(() => {
    applyBranding(settings);
  }, [settings]);

  const save = useCallback(
    async (patch: Partial<Omit<Settings, 'user_id'>>) => {
      if (!user) return;
      const updated = await saveSettings(user.id, patch);
      setSettings(updated);
    },
    [user],
  );

  const value: SettingsContextValue = {
    settings,
    store: getStoreConfig(settings?.store_type),
    loading,
    refresh,
    save,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

// Remember the store type a visitor chose on the signup form, to apply once
// their settings row is first created.
export function rememberPendingStoreType(t: string) {
  localStorage.setItem(PENDING_STORE_KEY, t);
}
