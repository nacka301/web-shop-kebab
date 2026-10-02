import QRCode from "qrcode";
import type { Source } from "@/lib/sources";

// Korekcija grešaka "Q" (~25 %): QR se čita i kad je ispis zaprljan ili malo oštećen.
const OPTIONS = { errorCorrectionLevel: "Q" as const, margin: 4 };

// https://stranica.hr/slug?src=qr
export function buildShopUrl(siteUrl: string, slug: string, src?: Source): string {
  const base = `${siteUrl.replace(/\/+$/, "")}/${slug}`;
  return src ? `${base}?src=${src}` : base;
}

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...OPTIONS, type: "svg", color: { dark: "#111111", light: "#ffffff" } });
}

export function qrPngDataUrl(url: string, width: number): Promise<string> {
  return QRCode.toDataURL(url, { ...OPTIONS, width, color: { dark: "#111111", light: "#ffffff" } });
}

export function qrPngBuffer(url: string, width: number): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...OPTIONS, width, type: "png", color: { dark: "#111111", light: "#ffffff" } });
}
