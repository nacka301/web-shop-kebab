"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { loginIdentifierToEmail } from "@/lib/auth/username";

const field =
  "mt-1 w-full rounded-xl border border-black/10 bg-white p-3.5 text-base outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

export default function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: loginIdentifierToEmail(identifier), password });
    if (signInError) {
      setError("Pogrešno korisničko ime ili lozinka.");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-bold">
        Korisničko ime
        <input type="text" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={field} />
      </label>
      <label className="block text-sm font-bold">
        Lozinka
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <button
        disabled={busy}
        className="min-h-12 w-full rounded-xl bg-[var(--brand)] py-3.5 font-bold text-white transition active:scale-[0.98] disabled:bg-black/20"
      >
        {busy ? "Prijava…" : "Prijavi se"}
      </button>
    </form>
  );
}
