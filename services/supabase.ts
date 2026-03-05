import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sfmdlovlpwelehoughgv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbWRsb3ZscHdlbGVob3VnaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTM1MTgsImV4cCI6MjA4Njc4OTUxOH0.DMMoRceOAnpsrZn_xmMUqYSfrJoolgl1IxcQ4pPFxcA';

const STORE_KEY_COMPANY_ID = 'crewflo_company_id';

// Singleton — une seule instance, Navigator Lock désactivé pour éviter les conflits
// Serialise les refreshes de token — empêche les appels simultanés qui révoquent
// mutuellement leurs tokens. Utilise Navigator Lock si disponible, sinon une
// queue maison (PWA installée sur iOS/Android n'a pas toujours Navigator Lock).
// Queue de sérialisation pour les environnements sans Navigator Lock
// (certaines PWA installées, iOS Safari, contextes isolés)
let refreshQueue: Promise<any> = Promise.resolve();
const serializedLock = async (_name: string, _timeout: number, fn: () => Promise<any>) => {
  refreshQueue = refreshQueue.then(() => fn()).catch(() => fn());
  return refreshQueue;
};

const hasNativeLock = typeof navigator !== 'undefined' && 'locks' in navigator;

// Si Navigator Lock natif disponible : ne pas passer lock du tout (Supabase l'utilise automatiquement)
// Sinon : queue maison pour sérialiser les refreshes et éviter token_revoked
export const supabase: SupabaseClient = hasNativeLock
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { lock: serializedLock },
      realtime: { params: { eventsPerSecond: 10 } },
    });

export const getSupabase = (): SupabaseClient => supabase;

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
