import { headers } from "next/headers";

// Javni URL aplikacije: NEXT_PUBLIC_SITE_URL, a ako nije postavljen, adresa s koje je stranica otvorena.
export async function getSiteUrl(): Promise<{ url: string; configured: boolean }> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return { url: configured.replace(/\/+$/, ""), configured: true };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { url: `${proto}://${host}`, configured: false };
}
