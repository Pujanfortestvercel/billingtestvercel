// ---------------------------------------------------------------------------
// THE SUPABASE CLIENT (web)
// ---------------------------------------------------------------------------
// One connection object the whole web app uses to talk to the database and
// authentication. On the web, supabase-js persists the session in
// localStorage and reads the auth token from the URL after email links — so
// the config differs slightly from the React Native app.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
} from '../config/supabase';

const url = isSupabaseConfigured ? SUPABASE_URL : 'http://localhost:54321';
const key = isSupabaseConfigured ? SUPABASE_ANON_KEY : 'placeholder-anon-key';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true, // keep the user logged in across page reloads
    autoRefreshToken: true, // keep the session valid in the background
    detectSessionInUrl: true, // handle email confirmation / magic links
  },
});

// Escape LIKE/ILIKE metacharacters (%, _, \) so user-typed text is matched
// LITERALLY instead of being interpreted as a wildcard pattern. Without this,
// a name like "A_C" or "50%" matches unintended rows (wrong customer/item, or
// a "search" that returns everything).
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, m => `\\${m}`);
}
