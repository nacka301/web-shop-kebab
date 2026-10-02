"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Printer } from "lucide-react";
import { buildShopUrl, qrPngDataUrl, qrSvg } from "@/lib/qr";
import type { Source } from "@/lib/sources";

const btn = "flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-bold transition active:scale-[0.97]";

const LINKS: { src: Source; title: string; where: string }[] = [
  { src: "ig", title: "Instagram bio", where: "Instagram → Uredi profil → Poveznice (ili „Web-mjesto”) → zalijepi link." },
  { src: "fb", title: "Facebook", where: "Facebook stranica radnje → Uredi podatke → Web-mjesto, ili gumb „Naruči”." },
  { src: "gmaps", title: "Google Maps profil", where: "Google Business Profile → Uredi profil → Kontakt → Web-mjesto (ili poveznica za naručivanje)." },
  { src: "wa", title: "WhatsApp / poruke", where: "Pošalji gostima u poruci ili postavi u WhatsApp Business profil." },
  { src: "qr", title: "Ispisani QR", where: "Isti link kao u QR kodu na plakatu — koristi ga ako QR tiskaš sam." },
];

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function QrPanel({ slug, name, siteUrl, siteUrlConfigured }: { slug: string; name: string; siteUrl: string; siteUrlConfigured: boolean }) {
  const publicUrl = buildShopUrl(siteUrl, slug);
  const qrUrl = buildShopUrl(siteUrl, slug, "qr");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void qrPngDataUrl(qrUrl, 480).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  const downloadSvg = async () => {
    const blob = new Blob([await qrSvg(qrUrl)], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    download(href, `${slug}-qr.svg`);
    URL.revokeObjectURL(href);
  };
  const downloadPng = async () => download(await qrPngDataUrl(qrUrl, 2048), `${slug}-qr.png`);

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-6">
      <h1 className="font-display text-2xl">Link i QR kod</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Gosti skeniraju QR ili otvore link i naruče. Svaki link nosi oznaku izvora, pa u Statistici vidiš odakle dolaze.</p>

      {!siteUrlConfigured && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Varijabla NEXT_PUBLIC_SITE_URL nije postavljena pa se koristi adresa ove stranice. Prije ispisa plakata postavi pravi javni URL.
        </p>
      )}

      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--muted)]">Javni link {name}</h2>
        <CopyRow value={publicUrl} big />
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--muted)]">QR kod</h2>
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`QR kod za ${publicUrl}`} width={240} height={240} className="h-60 w-60 rounded-xl border border-black/10" />
          ) : (
            <div className="h-60 w-60 animate-pulse rounded-xl bg-black/[0.06]" />
          )}
          <div className="w-full space-y-2">
            <p className="break-all text-sm text-[var(--muted)]">Vodi na: {qrUrl}</p>
            <button onClick={() => void downloadPng()} className={`${btn} w-full bg-[var(--brand)] text-white`}>
              <Download className="h-5 w-5" /> Preuzmi PNG (visoka rezolucija)
            </button>
            <button onClick={() => void downloadSvg()} className={`${btn} w-full bg-black/[0.06]`}>
              <Download className="h-5 w-5" /> Preuzmi SVG
            </button>
            <Link href="/admin/qr/plakat" className={`${btn} w-full border border-black/10 bg-white`}>
              <Printer className="h-5 w-5" /> Plakat i naljepnice za ispis
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-extrabold">Gotovi linkovi za kopiranje</h2>
        <div className="mt-2 space-y-3">
          {LINKS.map((link) => (
            <article key={link.src} className="rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow">
              <h3 className="font-extrabold">{link.title}</h3>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{link.where}</p>
              <CopyRow value={buildShopUrl(siteUrl, slug, link.src)} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function CopyRow({ value, big = false }: { value: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Starije preglednike bez clipboard API-ja pokrivamo označavanjem teksta.
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 flex items-stretch gap-2">
      <input readOnly value={value} onFocus={(event) => event.currentTarget.select()} className={`min-w-0 flex-1 rounded-xl border border-black/10 bg-black/[0.03] px-3 outline-none ${big ? "min-h-14 text-base font-bold" : "min-h-12 text-sm"}`} />
      <button onClick={() => void copy()} className={`${btn} shrink-0 ${copied ? "bg-green-600 text-white" : "bg-black/[0.06]"}`}>
        {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? "Kopirano" : "Kopiraj"}
      </button>
    </div>
  );
}
