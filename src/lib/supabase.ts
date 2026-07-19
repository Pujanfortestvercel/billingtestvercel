// ---------------------------------------------------------------------------
// THE SUPABASE CLIENT
// ---------------------------------------------------------------------------
// This creates ONE connection object ("client") that the whole app uses to
// talk to your database and authentication. We import `supabase` from here
// everywhere we need to read/write data or sign users in/out.
// ---------------------------------------------------------------------------

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
} from '../config/supabase';

// If the user hasn't pasted their real credentials yet, we use a harmless
// placeholder URL so the app still launches (instead of crashing). The app
// will simply show a "connect Supabase" message until real values are added.
const url = isSupabaseConfigured ? SUPABASE_URL : 'http://localhost:54321';
const key = isSupabaseConfigured ? SUPABASE_ANON_KEY : 'placeholder-anon-key';

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage, // save the login token on the device...
    persistSession: true, // ...so the user stays logged in after closing the app
    autoRefreshToken: true, // keep the session valid in the background
    detectSessionInUrl: false, // we're a mobile app, not a website with URLs
  },
});

// Escape LIKE/ILIKE metacharacters (%, _, \) so user-typed text is matched
// LITERALLY instead of being interpreted as a wildcard pattern. Without this,
// a name like "A_C" or "50%" matches unintended rows (wrong customer/item, or
// a "search" that returns everything).
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, m => `\\${m}`);
}
