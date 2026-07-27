// ---------------------------------------------------------------------------
// SUPABASE CONNECTION SETTINGS
// ---------------------------------------------------------------------------
// These values are read from environment variables so that real credentials
// never appear in source code or version control.
//
// For Vite, create a `.env` file in the `web/` directory:
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key-here
//
// Find them in the Supabase dashboard:  Project Settings → API
//   • "Project URL"              →  SUPABASE_URL
//   • "Project API keys" → anon  →  SUPABASE_ANON_KEY
//
// ⚠️ IMPORTANT SECURITY NOTE
//   The anon (public) key is SAFE to ship inside the app. It can ONLY do what
//   your Row Level Security rules allow — and those rules say "each user sees
//   only their own rows". So your business data stays private even though this
//   key is in the app.
//   NEVER paste the "service_role" SECRET key here — that one bypasses security.
// ---------------------------------------------------------------------------

export const SUPABASE_URL =
  (import.meta as any).env.VITE_SUPABASE_URL ??
  'https://yeijmqntdditskhptgbl.supabase.co';
export const SUPABASE_ANON_KEY =
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_PU19hw0CGh8nHlaa8NX8rg_VtNirLQU';

// True once you've added real values in your .env file. Until then, the app
// shows a friendly "connect your Supabase project" screen instead of crashing.
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
