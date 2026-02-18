import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Fallback hardcodé (clés publiques anon — safe)
const FALLBACK_URL = 'https://sfmdlovlpwelehoughgv.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbWRsb3ZscHdlbGVob3VnaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTM1MTgsImV4cCI6MjA4Njc4OTUxOH0.DMMoRceOAnpsrZn_xmMUqYSfrJoolgl1IxcQ4pPFxcA';

const STORE_KEY_URL = 'crewflo_supabase_url';
const STORE_KEY_KEY = 'crewflo_supabase_key';
const STORE_KEY_COMPANY_ID = 'crewflo_company_id';

let supabaseInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export const getSupabaseConfig = () => {
  const url =
    (ENV_URL && ENV_URL.trim()) ||
    localStorage.getItem(STORE_KEY_URL) ||
    FALLBACK_URL;
  const key =
    (ENV_KEY && ENV_KEY.trim()) ||
    localStorage.getItem(STORE_KEY_KEY) ||
    FALLBACK_KEY;
  return {
    url,
    key,
    companyId: localStorage.getItem(STORE_KEY_COMPANY_ID) || '',
    usingEnv: Boolean((ENV_URL && ENV_URL.trim()) && (ENV_KEY && ENV_KEY.trim())),
  };
};

export const getSupabase = (): SupabaseClient | null => {
  const { url, key } = getSupabaseConfig();

  if (!url || !key || !url.startsWith('http')) return null;

  if (supabaseInstance && url === lastUrl && key === lastKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    lastUrl = url;
    lastKey = key;
    return supabaseInstance;
  } catch (e) {
    console.error('Failed to init Supabase', e);
    return null;
  }
};

export const saveSupabaseConfig = (url: string, key: string, companyId: string) => {
  const usingEnv = Boolean((ENV_URL && ENV_URL.trim()) && (ENV_KEY && ENV_KEY.trim()));
  if (!usingEnv) {
    localStorage.setItem(STORE_KEY_URL, url);
    localStorage.setItem(STORE_KEY_KEY, key);
  }
  localStorage.setItem(STORE_KEY_COMPANY_ID, companyId.trim());
  supabaseInstance = null;
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem(STORE_KEY_URL);
  localStorage.removeItem(STORE_KEY_KEY);
  localStorage.removeItem(STORE_KEY_COMPANY_ID);
  supabaseInstance = null;
  window.location.reload();
};

export const setCompanyId = (companyId: string) => {
  localStorage.setItem(STORE_KEY_COMPANY_ID, companyId.trim());
};
