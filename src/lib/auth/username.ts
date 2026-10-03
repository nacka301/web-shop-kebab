// Vlasnici se mogu prijaviti korisničkim imenom (npr. "ankica"). Supabase Auth traži e-mail oblik,
// pa se ime iza kulisa pretvara u adresu koja nikad ne prima poštu.
export const USERNAME_EMAIL_DOMAIN = "prijava.local";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(input: string): string | null {
  const name = input.trim().toLowerCase();
  return USERNAME_PATTERN.test(name) ? name : null;
}

// Što god vlasnik upiše: pravi e-mail ostaje kakav je, korisničko ime postaje ime@prijava.local.
export function loginIdentifierToEmail(input: string): string {
  const value = input.trim();
  if (value.includes("@")) return value;
  const name = normalizeUsername(value);
  return `${name ?? value.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
