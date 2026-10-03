import { createBrowserClient } from "@supabase/ssr";

// Klijent za preglednik: anon ključ + sesija prijavljenog vlasnika, pa RLS vrijedi za sve upite.
// Service role se ovdje nikad ne koristi.
export function createBrowserSupabaseClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
