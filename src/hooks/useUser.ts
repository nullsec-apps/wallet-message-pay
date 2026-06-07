import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getPhoneCountry } from '../lib/phone';

/**
 * Loads / maintains the app-scoped user record (privy_user_id, phone_number,
 * wallet_address, country, login_method) and exposes verification status.
 * Every field originates from a real Supabase row — never fabricated.
 */

export interface AppUser {
  id: string;
  privy_user_id: string;
  phone_number: string;
  phone_country_code: string | null;
  wallet_address: string;
  login_method: string | null;
  display_name: string | null;
  country: string | null;
  is_verified: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}
const usersTable = () => `${projectPrefix()}users`;

export interface UseUser {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<AppUser, 'display_name' | 'country'>>) => Promise<void>;
}

export function useUser(privyUserId: string | null): UseUser {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!privyUserId) {
      setUser(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(usersTable())
        .select('*')
        .eq('privy_user_id', privyUserId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (err) throw err;
      const row = (data && data[0]) as AppUser | undefined;
      if (row && !row.country && row.phone_number) {
        row.country = getPhoneCountry(row.phone_number);
      }
      if (mounted.current) setUser(row ?? null);
    } catch (e: any) {
      if (mounted.current) setError(e?.message || 'Failed to load profile');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [privyUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<AppUser, 'display_name' | 'country'>>) => {
      if (!user) return;
      try {
        const { data, error: err } = await supabase
          .from(usersTable())
          .update(patch)
          .eq('id', user.id)
          .select('*')
          .single();
        if (err) throw err;
        if (mounted.current) setUser(data as AppUser);
      } catch (e: any) {
        if (mounted.current) setError(e?.message || 'Failed to update profile');
      }
    },
    [user]
  );

  return { user, loading, error, refresh, updateProfile };
}
