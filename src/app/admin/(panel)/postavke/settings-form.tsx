"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { isValidEmail } from "@/lib/validation";

const field =
  "mt-1 min-h-12 w-full rounded-xl border border-black/15 bg-white px-3 text-base outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

export default function SettingsForm({ restaurantId, initialEmail, initialIgnoreHours, mailConfigured }: { restaurantId: string; initialEmail: string; initialIgnoreHours: boolean; mailConfigured: boolean }) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ignoreHours, setIgnoreHours] = useState(initialIgnoreHours);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const toggleIgnoreHours = async () => {
    const next = !ignoreHours;
    setTestMessage(null);
    const { data, error } = await createBrowserSupabaseClient().from("restaurants").update({ ignore_hours: next }).eq("id", restaurantId).select("id");
    if (error || !data?.length) setTestMessage("Promjena nije spremljena. Pokušaj ponovno.");
    else {
      setIgnoreHours(next);
      setTestMessage(next ? "Testni način je uključen: gosti mogu naručivati u bilo koje doba." : "Testni način je isključen: opet vrijedi radno vrijeme.");
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (value && !isValidEmail(value)) {
      setMessage({ tone: "error", text: "Upiši ispravnu e-mail adresu, npr. ime@primjer.hr." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error } = await createBrowserSupabaseClient()
      .from("restaurants")
      .update({ owner_email: value || null })
      .eq("id", restaurantId)
      .select("id");
    setBusy(false);
    if (error || !data?.length) setMessage({ tone: "error", text: "Promjena nije spremljena. Provjeri adresu i pokušaj ponovno." });
    else setMessage({ tone: "ok", text: value ? "Spremljeno. Nove narudžbe stizat će i na ovaj e-mail." : "Spremljeno. E-mail obavijesti su isključene." });
  };

  return (
    <main className="mx-auto max-w-xl px-4 pb-8 pt-4 sm:px-6">
      <h1 className="font-display text-2xl">Postavke</h1>

      <form onSubmit={save} className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow">
        <label className="block text-base font-bold">
          E-mail za obavijesti o narudžbama
          <input type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ime@primjer.hr" className={field} />
        </label>
        <p className="text-base text-[var(--muted)]">
          Svaka nova narudžba stiže i na ovaj e-mail, za slučaj da ti je admin zatvoren ili je ekran ugašen. Ostavi prazno da isključiš obavijesti.
        </p>
        {!mailConfigured && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-base font-semibold text-amber-800">
            Slanje e-maila još nije podešeno na poslužitelju (RESEND_API_KEY i RESEND_FROM), pa obavijesti zasad ne stižu.
          </p>
        )}
        {message && (
          <p role="status" className={`rounded-xl px-3 py-2 text-base font-bold ${message.tone === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </p>
        )}
        <button disabled={busy} className="min-h-12 w-full rounded-xl bg-[var(--brand)] py-3 text-base font-bold text-white transition active:scale-[0.98] disabled:bg-black/20">
          {busy ? "Spremanje…" : "Spremi"}
        </button>
      </form>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow">
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-base font-bold">Testni način: ignoriraj radno vrijeme</span>
            <span className="block text-base text-[var(--muted)]">Radnja se ponaša kao da je uvijek otvorena, pa možeš isprobavati narudžbe i izvan radnog vremena.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={ignoreHours}
            onChange={() => void toggleIgnoreHours()}
            className="relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-black/20 transition-colors before:absolute before:left-1 before:top-1 before:h-6 before:w-6 before:rounded-full before:bg-white before:transition-transform checked:bg-amber-500 checked:before:translate-x-6"
          />
        </label>
        {ignoreHours && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-base font-bold text-amber-800">Uključeno je. Isključi prije nego što radnja počne raditi s pravim gostima.</p>}
        {testMessage && <p role="status" className="mt-2 rounded-xl bg-black/[0.04] px-3 py-2 text-base font-semibold">{testMessage}</p>}
      </section>
    </main>
  );
}
