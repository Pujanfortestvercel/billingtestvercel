// ---------------------------------------------------------------------------
// SETTINGS SERVICE — the user's store type + shop profile (name, logo, phone,
// address). One row per user; RLS keeps it private. (See migration 002.)
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';
import type { Settings } from '../types/models';

export async function getSettings(userId: string): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Settings) ?? null;
}

// Create the row if missing (used on first load), with an optional store type.
export async function ensureSettings(
  userId: string,
  storeType = 'grocery',
): Promise<Settings> {
  const existing = await getSettings(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('settings')
    .insert({ user_id: userId, store_type: storeType })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Settings;
}

export async function saveSettings(
  userId: string,
  patch: Partial<Omit<Settings, 'user_id'>>,
): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Settings;
}
