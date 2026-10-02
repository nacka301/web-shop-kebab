export function isValidCroatianPhone(raw: string): boolean {
  const normalized = raw.replace(/[\s-]/g, "");
  return /^(?:\+385|0)9\d{7,8}$/.test(normalized);
}

export function isValidName(raw: string): boolean {
  return /^\s*\S+\s+\S+.*$/.test(raw.trim());
}
