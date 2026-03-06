import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sfmdlovlpwelehoughgv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbWRsb3ZscHdlbGVob3VnaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTM1MTgsImV4cCI6MjA4Njc4OTUxOH0.DMMoRceOAnpsrZn_xmMUqYSfrJoolgl1IxcQ4pPFxcA';

const STORE_KEY_COMPANY_ID = 'crewflo_company_id';

// Le lock fn() direct est requis pour éviter les deadlocks dans le contexte PWA Chrome.
// Les refreshes concurrents sont contrôlés autrement :
// — seul App.tsx appelle refreshSession (keepalive 30s + visibilitychange)
// — useSyncStore ne fait plus aucun refreshSession
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
  realtime: { params: { eventsPerSecond: 10 } },
});

export const getSupabase = (): SupabaseClient => supabase;

// ── Refresh session centralisé ────────────────────────────────────────────────
// Un seul refreshSession actif à la fois, partagé entre App.tsx et tous les
// useSyncStore. Si un refresh est déjà en cours, les appels suivants attendent
// le même Promise au lieu d'en lancer un nouveau (évite token_revoked en cascade).
let _refreshPromise: Promise<void> | null = null;
let _lastRefresh = 0;

export const guardedRefreshSession = async (): Promise<void> => {
  if (_refreshPromise) return _refreshPromise;             // déjà en cours — attendre
  if (Date.now() - _lastRefresh < 10_000) return;         // trop récent — ignorer
  _refreshPromise = supabase.auth.refreshSession()
    .then(() => { _lastRefresh = Date.now(); })
    .catch(() => {})
    .finally(() => { _refreshPromise = null; });
  return _refreshPromise;
};

export const getSupabaseConfig = () => ({
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  companyId: localStorage.getItem(STORE_KEY_COMPANY_ID) || '',
  usingEnv: false,
});

export const saveSupabaseConfig = (_url: string, _key: string, companyId: string) => {
  localStorage.setItem(STORE_KEY_COMPANY_ID, companyId.trim());
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem(STORE_KEY_COMPANY_ID);
  window.location.reload();
};

export const setCompanyId = (companyId: string) => {
  localStorage.setItem(STORE_KEY_COMPANY_ID, companyId.trim());
};
