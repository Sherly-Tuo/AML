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
  avatar_url: string | null;
};

type AuthContextValue = {
  hasSupabaseConfig: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isFirstTime: boolean;
  signUpWithPassword: (input: { email: string; password: string; displayName: string }) => Promise<{ error: string | null }>;
  signInWithPassword: (input: { email: string; password: string }) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  markOnboarded: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, 'display_name' | 'postcode' | 'avatar_url'>>) => Promise<{ error: string | null }>;
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
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
  };
};

const getUserMetaProfile = (user: User | null) => ({
  display_name: typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null,
  avatar_url: typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
});

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
      const metaProfile = getUserMetaProfile(user);
      const displayName = metaProfile.display_name;

      const { error: upsertError } = await client.from('profiles').upsert(
        {
          id: user.id,
          email,
          display_name: displayName,
          avatar_url: metaProfile.avatar_url,
        },
        { onConflict: 'id' },
      );

      if (upsertError) {
        console.error('Supabase profile upsert failed', upsertError);
      }

      const { data, error } = await client
        .from('profiles')
        .select('id, email, display_name, postcode, onboarded_at, avatar_url')
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
          avatar_url: null,
        });
        return;
      }

      const fallbackProfile = {
        id: user.id,
        email,
        display_name: displayName,
        postcode: null,
        onboarded_at: null,
        avatar_url: metaProfile.avatar_url,
      };

      const mapped = mapProfile(data);
      setProfile(
        mapped
          ? {
              ...mapped,
              display_name: mapped.display_name ?? metaProfile.display_name,
              avatar_url: mapped.avatar_url ?? metaProfile.avatar_url,
            }
          : fallbackProfile,
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
      updateProfile: async (patch) => {
        if (!supabase || !user) {
          return { error: 'Supabase is not configured.' };
        }

        const metadataPatch: Record<string, string> = {};
        if (typeof patch.display_name === 'string') {
          metadataPatch.display_name = patch.display_name;
        }
        if (typeof patch.avatar_url === 'string') {
          metadataPatch.avatar_url = patch.avatar_url;
        }

        if (Object.keys(metadataPatch).length > 0) {
          const { error: userError } = await supabase.auth.updateUser({
            data: metadataPatch,
          });

          if (userError) {
            return { error: userError.message };
          }
        }

        const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);

        if (error) {
          if (error.message.includes('updated_at')) {
            setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
            return { error: null };
          }
          return { error: error.message };
        }

        setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
        return { error: null };
      },
      signUpWithPassword: async ({ email, password, displayName }) => {
        if (!supabase) {
          return { error: 'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
          },
        });

        return { error: error?.message ?? null };
      },
      signInWithPassword: async ({ email, password }) => {
        if (!supabase) {
          return { error: 'Supabase is not configured.' };
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        return { error: error?.message ?? null };
      },
      requestPasswordReset: async (email: string) => {
        if (!supabase) {
          return { error: 'Supabase is not configured.' };
        }

        const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${redirectTo.origin}${redirectTo.pathname}auth`,
        });

        return { error: error?.message ?? null };
      },
      updatePassword: async (password: string) => {
        if (!supabase) {
          return { error: 'Supabase is not configured.' };
        }

        const { error } = await supabase.auth.updateUser({ password });
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
