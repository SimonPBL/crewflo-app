import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Clés hardcodées — anon/public, safe à exposer
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://sfmdlovlpwelehoughgv.supabase.co';
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbWRsb3ZscHdlbGVob3VnaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTM1MTgsImV4cCI6MjA4Njc4OTUxOH0.DMMoRceOAnpsrZn_xmMUqYSfrJoolgl1IxcQ4pPFxcA';

const STORE_KEY_COMPANY_ID = 'crewflo_company_id';

// UN SEUL client, créé une fois au démarrage du module — jamais recréé
// Cela évite le conflit de Navigator LockManager qui causait le timeout
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// Compatibilité avec le code existant qui appelle getSupabase()
export const getSupabase = (): SupabaseClient => supabase;

export const getSupabaseConfig = () => ({
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  companyId: localStorage.getItem(STORE_KEY_COMPANY_ID) || '',
  usingEnv: Boolean(import.meta.env.VITE_SUPABASE_URL),
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
