// Izvor posjete/narudžbe dolazi iz parametra ?src= i prihvaća se SAMO iz ovog popisa.
export const SOURCES = ["qr", "ig", "fb", "gmaps", "wa", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  qr: "QR kod",
  ig: "Instagram",
  fb: "Facebook",
  gmaps: "Google Maps",
  wa: "WhatsApp / poruke",
  other: "Ostalo",
};

const KNOWN = new Set<string>(SOURCES);

// Narudžba: bez parametra = null (izravan dolazak), nepoznata vrijednost = 'other'.
export function normalizeSource(raw: string | null | undefined): Source | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  return KNOWN.has(value) ? (value as Source) : "other";
}

// Posjet: uvijek neki izvor; bez parametra ili nepoznat = 'other'.
export function normalizeViewSource(raw: string | null | undefined): Source {
  return normalizeSource(raw) ?? "other";
}
