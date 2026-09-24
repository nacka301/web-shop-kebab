"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { menu, shop } from "@/data/demo";

export default function Home() {
  const [step, setStep] = useState<1 | 2>(1);
  const router = useRouter();
  const [email, setEmail] = useState("admin@mambokebab.hr");
  const [password, setPassword] = useState("demo123");
  const [previewAdded, setPreviewAdded] = useState<Record<string, boolean>>({});
  const [demoLoggedIn, setDemoLoggedIn] = useState(false);
  const [previewCategory, setPreviewCategory] = useState("Sve");
  const previewCount = Object.values(previewAdded).filter(Boolean).length;
  const togglePreviewItem = (id: string) => setPreviewAdded((current) => ({ ...current, [id]: !current[id] }));
  const previewItems = menu.filter((item) => previewCategory === "Sve" || item.category === previewCategory).slice(0, 3);

  return (
    <main className="min-h-screen bg-[#fbf8f5] px-4 py-8 text-[#171714] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-9 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tight">mambo<span className="text-[var(--brand)]">.</span></div>
          <span className="rounded-full bg-[#fff0e8] px-3 py-1.5 text-xs font-bold text-[var(--brand-dark)]">MVP demo za kebab radnje</span>
        </header>

        <div className="mb-9 flex items-center justify-center gap-8 text-center text-xs font-semibold sm:gap-20">
          <button onClick={() => setStep(1)} className="relative flex flex-col items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full font-black ${step === 1 ? "bg-[var(--brand)] text-white" : "bg-black/10 text-[var(--muted)]"}`}>1</span>
            <span className={step === 1 ? "text-black" : "text-[var(--muted)]"}>1. Kupac vidi meni</span>
          </button>
          <div className="h-px w-10 bg-black/10 sm:w-24" />
          <button onClick={() => setStep(2)} className="relative flex flex-col items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full font-black ${step === 2 ? "bg-[var(--brand)] text-white" : "bg-black/10 text-[var(--muted)]"}`}>2</span>
            <span className={step === 2 ? "text-black" : "text-[var(--muted)]"}>2. Radnja upravlja narudžbama</span>
          </button>
        </div>

        {step === 1 ? (
          <section>
            <div className="mx-auto mb-6 max-w-3xl text-center">
              <h1 className="text-3xl font-black sm:text-4xl">Kebab naručivanje</h1>
            </div>
            <div className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-black/5 bg-white shadow-xl">
              <div className="bg-[#171714] px-5 py-6 text-white">
                <p className="text-xs text-white/60">{shop.hours}</p>
                <h2 className="mt-1 text-3xl font-black">{shop.name}</h2>
              </div>
              <div className={`bg-[#f7f7f4] p-4 sm:p-5 ${previewCount > 0 ? "pb-20" : ""}`}>
                <div className="mb-4 flex gap-2 overflow-x-auto">
                  {["Sve", "Kebab", "Prilozi", "Piće"].map((category) => <button key={category} onClick={() => setPreviewCategory(category)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${previewCategory === category ? "bg-black text-white" : "bg-white text-[var(--muted)]"}`}>{category}</button>)}
                </div>
                <div className="space-y-3">
                  {previewItems.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#fff0e8] text-3xl">{item.emoji}</span><div className="min-w-0 flex-1"><p className="font-bold">{item.name}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{item.description}</p><p className="mt-1 text-sm font-black">{item.price.toFixed(2).replace(".", ",")} €</p></div><button onClick={() => togglePreviewItem(item.id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${previewAdded[item.id] ? "bg-[var(--brand)] text-white" : "bg-[#fff0e8] text-[var(--brand-dark)]"}`}>{previewAdded[item.id] ? "✓ Dodano" : "+ Dodaj"}</button></div>)}
                  {previewItems.length === 0 && <p className="rounded-2xl bg-white p-4 text-center text-sm text-[var(--muted)]">Nema artikala u ovoj kategoriji.</p>}
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-[var(--brand)]/40 bg-[#fff0e8]/50 p-4"><p className="text-sm font-black">Kupac jednostavno bira dodatke</p><p className="mt-1 text-xs leading-5 text-[var(--brand-dark)]">Blagi · Ljuti · Majoneza · Kečap<br />Salata · Luk · Kupus · Krastavac · Feferoni</p></div>
              </div>
              {previewCount > 0 && <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white shadow-lg"><span>{previewCount} {previewCount === 1 ? "stavka" : "stavke"}</span><span>Košarica (pregled)</span></div>}
            </div>
            <div className="mx-auto mt-4 max-w-xl text-center">
              <button onClick={() => router.push(`/${shop.slug}`)} className="text-sm font-bold text-[var(--brand)] underline underline-offset-2">Isprobaj cijelu narudžbu uživo →</button>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-xl">
            <div className="mb-6"><p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Demo za vlasnika ili radnika</p><h1 className="text-3xl font-black sm:text-4xl">Prijava u aplikaciju radnje</h1><p className="mt-2 text-[var(--muted)]">Ovdje radnja vidi nove narudžbe i premješta ih kroz pripremu.</p></div>
            <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8"><label className="block text-sm font-bold">E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 p-3.5 outline-none focus:border-[var(--brand)]" /></label><label className="mt-4 block text-sm font-bold">Lozinka<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 p-3.5 outline-none focus:border-[var(--brand)]" /></label><button onClick={() => setDemoLoggedIn(true)} className="mt-5 w-full rounded-xl bg-[var(--brand)] py-3.5 font-bold text-white">{demoLoggedIn ? "✓ Prijavljeni ste (demo)" : "Prijavi se u dashboard"}</button><div className="mt-5 rounded-xl border border-dashed border-black/10 bg-[#fbf8f5] p-4 text-sm"><p className="font-bold">Demo pristup</p><p className="mt-1 font-mono text-xs text-[var(--muted)]">admin@mambokebab.hr / demo123</p></div></div>
            <div className="mt-4 text-center"><button onClick={() => router.push(`/${shop.slug}/admin`)} className="text-sm font-bold text-[var(--brand)] underline underline-offset-2">Otvori pravi dashboard →</button></div>
            <button onClick={() => setStep(1)} className="mt-5 block w-full text-center text-sm font-bold text-[var(--muted)] underline">← Natrag na prikaz za kupca</button>
          </section>
        )}
      </div>
    </main>
  );
}
