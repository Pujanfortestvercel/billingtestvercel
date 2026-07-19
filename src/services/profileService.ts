// ---------------------------------------------------------------------------
// PROFILE SERVICE — a user's role (admin or normal user) + email.
// A "profile" row is created automatically on signup (see schema.sql).
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabase';

export type Role = 'user' | 'admin';

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
  created_at: string;
};

// Read the logged-in user's own profile (to learn their role).
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}
