// ---------------------------------------------------------------------------
// SETTINGS CONTEXT — loads the logged-in user's store type + shop profile once
// and shares it with every screen (billing form, invoices, dashboard). Creates
// the row on first load, honouring a store type the user picked at signup
// (stashed in AsyncStorage). Call `save()` to persist changes.
//
// Note: the web app also rebuilds the browser tab / PWA icon from these
// settings (branding). That is DOM-only and not applicable to a native app —
// a packaged app's launcher icon is fixed at build time — so it's omitted here.
// ---------------------------------------------------------------------------
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import type { Settings } from '../types/models';
import {
  ensureSettings,
  getSettings,
  saveSettings,
} from '../services/settingsService';
import { getStoreConfig, type StoreTypeConfig } from '../config/storeTypes';

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

export function SettingsProvider({ children }: PropsWithChildren) {
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
    (async () => {
      let pending = 'grocery';
      try {
        pending = (await AsyncStorage.getItem(PENDING_STORE_KEY)) || 'grocery';
      } catch {
        // AsyncStorage unavailable — fall back to the default store type.
      }
      try {
        const s = await ensureSettings(user.id, pending);
        if (!active) return;
        setSettings(s);
        await AsyncStorage.removeItem(PENDING_STORE_KEY).catch(() => {});
      } catch {
        if (active) setSettings(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

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
export async function rememberPendingStoreType(t: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_STORE_KEY, t);
  } catch {
    // Non-fatal — the user can still pick their store type in Settings.
  }
}
