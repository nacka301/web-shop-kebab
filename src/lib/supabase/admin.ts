import { createClient } from "@supabase/supabase-js";

// Service role zaobilazi RLS: smije se koristiti SAMO u route handlerima / server actionima.
// Ključ nikad nema prefiks NEXT_PUBLIC_ i ne smije se uvoziti iz "use client" datoteka.
export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role nije konfiguriran.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
