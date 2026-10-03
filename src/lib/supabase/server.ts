import { createClient } from "@supabase/supabase-js";

// Anonimni klijent (RLS): smije samo čitati radnje i jelovnik.
export function createServerSupabaseClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
