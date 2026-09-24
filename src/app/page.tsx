"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { menu, shop } from "@/data/demo";

export default function Home() {
  const [step, setStep] = useState<1 | 2>(1);
  const router = useRouter();
  const [email, setEmail] = useState("admin@mambokebab.hr");
  const [password, setPassword] = useState("demo123");

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
            <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-black/5 bg-white shadow-xl">
              <div className="bg-[#171714] px-5 py-6 text-white">
                <p className="text-xs text-white/60">{shop.hours}</p>
                <h2 className="mt-1 text-3xl font-black">{shop.name}</h2>
                <p className="mt-1 text-sm text-white/60">{shop.address}</p>
              </div>
              <div className="bg-[#f7f7f4] p-4 sm:p-5">
                <div className="mb-4 flex gap-2 overflow-x-auto">
                  {["Sve", "Kebab", "Prilozi", "Piće"].map((category, index) => <span key={category} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${index === 0 ? "bg-black text-white" : "bg-white text-[var(--muted)]"}`}>{category}</span>)}
                </div>
                <div className="space-y-3">
                  {menu.slice(0, 3).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#fff0e8] text-3xl">{item.emoji}</span><div className="min-w-0 flex-1"><p className="font-bold">{item.name}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{item.description}</p><p className="mt-1 text-sm font-black">{item.price.toFixed(2).replace(".", ",")} €</p></div><button onClick={() => router.push(`/${shop.slug}`)} className="rounded-lg bg-[#fff0e8] px-3 py-2 text-xs font-bold text-[var(--brand-dark)]">+ Dodaj</button></div>)}
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-[var(--brand)]/40 bg-[#fff0e8]/50 p-4"><p className="text-sm font-black">Kupac jednostavno bira dodatke</p><p className="mt-1 text-xs leading-5 text-[var(--brand-dark)]">Blagi · Ljuti · Majoneza · Kečap<br />Salata · Luk · Kupus · Krastavac · Feferoni</p></div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-xl">
            <div className="mb-6"><p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Demo za vlasnika ili radnika</p><h1 className="text-3xl font-black sm:text-4xl">Prijava u aplikaciju radnje</h1><p className="mt-2 text-[var(--muted)]">Ovdje radnja vidi nove narudžbe i premješta ih kroz pripremu.</p></div>
            <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8"><label className="block text-sm font-bold">E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 p-3.5 outline-none focus:border-[var(--brand)]" /></label><label className="mt-4 block text-sm font-bold">Lozinka<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 p-3.5 outline-none focus:border-[var(--brand)]" /></label><button onClick={() => router.push(`/${shop.slug}/admin`)} className="mt-5 w-full rounded-xl bg-[var(--brand)] py-3.5 font-bold text-white">Prijavi se u dashboard</button><div className="mt-5 rounded-xl border border-dashed border-black/10 bg-[#fbf8f5] p-4 text-sm"><p className="font-bold">Demo pristup</p><p className="mt-1 font-mono text-xs text-[var(--muted)]">admin@mambokebab.hr / demo123</p></div></div>
            <button onClick={() => setStep(1)} className="mt-5 block w-full text-center text-sm font-bold text-[var(--muted)] underline">← Natrag na prikaz za kupca</button>
          </section>
        )}
      </div>
    </main>
  );
}
