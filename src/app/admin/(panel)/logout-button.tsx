"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const logout = async () => {
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };
  return (
    <button onClick={logout} className={`min-h-12 rounded-xl px-4 text-sm font-bold text-[var(--muted)] transition hover:bg-black/[0.05] ${className}`}>
      Odjava
    </button>
  );
}
