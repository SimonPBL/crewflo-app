import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- CrewFlo Supabase bootstrap ---
// Prefer Vercel/CI env vars (recommended). Fallback to localStorage (legacy UI setup).
const ENV_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const ENV_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

// Legacy keys stored in localStorage (avoid for production)
const STORE_KEY_URL = 'crewflo_supabase_url';
const STORE_KEY_KEY = 'crewflo_supabase_key';

// Multi-tenant scope (still stored locally for now)
const STORE_KEY_COMPANY_ID = 'crewflo_company_id';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseConfig = () => {
  const url = (ENV_URL && ENV_URL.trim()) || localStorage.getItem(STORE_KEY_URL) || '';
  const key = (ENV_KEY && ENV_KEY.trim()) || localStorage.getItem(STORE_KEY_KEY) || '';
  return {
    url,
    key,
    companyId: localStorage.getItem(STORE_KEY_COMPANY_ID) || '',
    usingEnv: Boolean((ENV_URL && ENV_URL.trim()) && (ENV_KEY && ENV_KEY.trim())),
  };
};

export const saveSupabaseConfig = (url: string, key: string, companyId: string) => {
  // If env vars are set, we only persist companyId.
  const usingEnv = Boolean((ENV_URL && ENV_URL.trim()) && (ENV_KEY && ENV_KEY.trim()));

  if (!usingEnv) {
    localStorage.setItem(STORE_KEY_URL, url);
    localStorage.setItem(STORE_KEY_KEY, key);
  }
  localStorage.setItem(STORE_KEY_COMPANY_ID, companyId.trim());

  // Force reload to init client with new scope
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  // Don't touch env vars (can't from browser), only clear local overrides.
  localStorage.removeItem(STORE_KEY_URL);
  localStorage.removeItem(STORE_KEY_KEY);
  localStorage.removeItem(STORE_KEY_COMPANY_ID);
  window.location.reload();
};

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const { url, key } = getSupabaseConfig();

  if (url && key && url.startsWith('http')) {
    try {
      supabaseInstance = createClient(url, key, {
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      });
      return supabaseInstance;
    } catch (e) {
      console.error('Failed to init Supabase', e);
      return null;
    }
  }
  return null;
};

export const setCompanyId = (companyId: string) => {
  localStorage.setItem(STORE_KEY_COMPANY_ID, companyId.trim());
};
