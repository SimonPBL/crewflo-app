import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sfmdlovlpwelehoughgv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbWRsb3ZscHdlbGVob3VnaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTM1MTgsImV4cCI6MjA4Njc4OTUxOH0.DMMoRceOAnpsrZn_xmMUqYSfrJoolgl1IxcQ4pPFxcA';

const STORE_KEY_COMPANY_ID = 'crewflo_company_id';

// Singleton — une seule instance, Navigator Lock désactivé pour éviter les conflits
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
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
