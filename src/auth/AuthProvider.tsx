import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';

type UserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  postcode: string | null;
  onboarded_at: string | null;
};

type AuthContextValue = {
  hasSupabaseConfig: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isFirstTime: boolean;
  requestMagicLink: (email: string) => Promise<{ error: string | null }>;
  requestPhoneOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  markOnboarded: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const mapProfile = (row: Record<string, unknown> | null): UserProfile | null => {
  if (!row) {
    return null;
  }

  return {
    id: typeof row.id === 'string' ? row.id : '',
    email: typeof row.email === 'string' ? row.email : null,
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    postcode: typeof row.postcode === 'string' ? row.postcode : null,
    onboarded_at: typeof row.onboarded_at === 'string' ? row.onboarded_at : null,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let isMounted = true;

    const syncSession = async () => {
      const { data, error } = await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Supabase session bootstrap failed', error);
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    void syncSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      return;
    }

    const client = supabase;
    let isMounted = true;

    const syncProfile = async () => {
      const email = user.email ?? null;
      const displayName =
        typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null;

      const { error: upsertError } = await client.from('profiles').upsert(
        {
          id: user.id,
          email,
          display_name: displayName,
        },
        { onConflict: 'id' },
      );

      if (upsertError) {
        console.error('Supabase profile upsert failed', upsertError);
      }

      const { data, error } = await client
        .from('profiles')
        .select('id, email, display_name, postcode, onboarded_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Supabase profile fetch failed', error);
        setProfile({
          id: user.id,
          email,
          display_name: displayName,
          postcode: null,
          onboarded_at: null,
        });
        return;
      }

      setProfile(
        mapProfile(data) ?? {
          id: user.id,
          email,
          display_name: displayName,
          postcode: null,
          onboarded_at: null,
        },
      );
    };

    void syncProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      hasSupabaseConfig,
      loading,
      session,
      user,
      profile,
      isFirstTime: !!user && profile !== null && profile.onboarded_at === null,
      markOnboarded: async () => {
        if (!supabase || !user) return;
        const now = new Date().toISOString();
        await supabase.from('profiles').update({ onboarded_at: now }).eq('id', user.id);
        setProfile((prev) => (prev ? { ...prev, onboarded_at: now } : prev));
      },
      requestMagicLink: async (email: string) => {
        if (!supabase) {
          return { error: 'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
        }

        const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin);
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${redirectTo.origin}${redirectTo.pathname}auth`,
          },
        });

        return { error: error?.message ?? null };
      },
      requestPhoneOtp: async (phone: string) => {
        if (!supabase) {
          return { error: 'Supabase is not configured.' };
        }
        const { error } = await supabase.auth.signInWithOtp({ phone });
        return { error: error?.message ?? null };
      },
      verifyPhoneOtp: async (phone: string, token: string) => {
        if (!supabase) {
          return { error: 'Supabase is not configured.' };
        }
        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        if (!supabase) {
          return;
        }

        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [loading, profile, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
