// ---------------------------------------------------------------------------
// AUTH CONTEXT
// ---------------------------------------------------------------------------
// Shares with the whole app: who is logged in, their ROLE (admin vs user),
// and functions to sign up / sign in / sign out.
// Includes 4-second heartbeat session verification for instant auto-logout
// when an account is deleted by Admin!
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getMyProfile, type Profile } from '../services/profileService';

type AuthResult = { error: string | null };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  initializing: boolean; // checking for a saved login on startup
  profile: Profile | null; // role + email
  isAdmin: boolean;
  profileLoading: boolean; // looking up the role after login
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // 1) Restore any saved session on startup, then listen for auth changes.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) Whenever the logged-in user changes, look up their profile (role).
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    getMyProfile(userId)
      .then(p => {
        if (active) {
          if (!p) {
            supabase.auth.signOut();
            setSession(null);
            setProfile(null);
          } else {
            setProfile(p);
          }
        }
      })
      .catch(() => {
        if (active) {
          supabase.auth.signOut();
          setSession(null);
          setProfile(null);
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // 3) Heartbeat session verification: check if account was deleted by Admin
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const heartbeat = setInterval(async () => {
      try {
        const p = await getMyProfile(userId);
        if (!p) {
          console.warn('Account was deleted by Admin. Logging out immediately...');
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
        }
      } catch (e) {
        console.warn('Profile check failed. Logging out...');
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
      }
    }, 4000);

    return () => clearInterval(heartbeat);
  }, [session?.user?.id]);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    initializing,
    profile,
    isAdmin: profile?.role === 'admin',
    profileLoading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return ctx;
}
