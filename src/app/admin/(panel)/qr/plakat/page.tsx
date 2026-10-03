import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import { buildShopUrl } from "@/lib/qr";
import { getSiteUrl } from "@/lib/site-url";
import FitPreview from "./fit-preview";
import PrintButton from "./print-button";
import { Poster, Stickers } from "./poster";

export const dynamic = "force-dynamic";

export default async function PosterPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/admin/login");

  const { v } = await searchParams;
  const stickers = v === "naljepnice";
  const site = await getSiteUrl();
  const { name, slug, accentColor } = context.restaurant;
  const url = buildShopUrl(site.url, slug, "qr");

  return (
    <main className="px-4 py-4 print:p-0">
      {/* Za ispis: A4 bez margina, a izbornik i gumbi se skrivaju. */}
      <style>{"@media print { @page { size: A4; margin: 0 } html, body { background: #fff !important } }"}</style>

      <div className="mx-auto mb-4 grid max-w-[210mm] grid-cols-2 gap-2 print:hidden sm:flex sm:flex-wrap sm:items-center">
        <Link href="/admin/qr" className="flex min-h-12 items-center justify-center rounded-xl bg-black/[0.06] px-4 text-base font-bold">← Natrag</Link>
        <Link href="/admin/qr/plakat" className={`flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-bold ${stickers ? "bg-black/[0.06]" : "bg-[var(--brand)] text-white"}`}>A4 plakat</Link>
        <Link href="/admin/qr/plakat?v=naljepnice" className={`flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-bold ${stickers ? "bg-[var(--brand)] text-white" : "bg-black/[0.06]"}`}>Naljepnice (6 na A4)</Link>
        <span className="hidden flex-1 sm:block" />
        <PrintButton />
      </div>
      <p className="mx-auto mb-4 max-w-[210mm] text-base text-[var(--muted)] print:hidden">
        QR vodi na {url}. U dijalogu za ispis odaberi A4, mjerilo 100 % i uključi „Pozadinske grafike”.
      </p>

      <FitPreview>
        {stickers ? <Stickers name={name} color={accentColor} url={url} /> : <Poster name={name} color={accentColor} url={url} />}
      </FitPreview>
    </main>
  );
}
