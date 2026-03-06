/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  throw new Error("Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon);
