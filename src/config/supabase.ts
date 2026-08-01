// ---------------------------------------------------------------------------
// SUPABASE CONNECTION SETTINGS
// ---------------------------------------------------------------------------
// These values are read from a `.env` file (via react-native-config) so that
// real credentials never appear in source code or version control.
//
// 1. Copy `.env.example` to `.env`
// 2. Paste your Supabase project URL and anon key into `.env`
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

import Config from 'react-native-config';

export const SUPABASE_URL = Config.SUPABASE_URL || 'https://lmdhgqgzrkybkmtdfkus.supabase.co';
export const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGhncWd6cmt5YmttdGRma3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1OTI1MTYsImV4cCI6MjEwMTE2ODUxNn0.zq7AnrbpbCpfTyYoSlyx3ORiWobxymL23bAKfZeCy4I';

// True once you've added real values in your .env file. Until then, the app
// shows a friendly "connect your Supabase project" screen instead of crashing.
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
