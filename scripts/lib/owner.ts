// Kreiranje računa vlasnika i vezanje uz radnju (dijele ga onboard.ts i create-owner.ts).
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loginIdentifierToEmail, normalizeUsername } from "../../src/lib/auth/username";

// Prihvaća pravi e-mail ili korisničko ime. Vraća što se upisuje u Supabase Auth.
export function resolveOwnerLogin(identifier: string): { email: string; label: string } {
  const value = identifier.trim();
  if (value.includes("@")) return { email: value, label: value };
  const name = normalizeUsername(value);
  if (!name) throw new Error("Korisničko ime: 3–32 znaka, mala slova, brojke, točka, crtica ili podvlaka.");
  return { email: loginIdentifierToEmail(name), label: name };
}

export async function createOwner(client: SupabaseClient, identifier: string, restaurantId: string) {
  const { email, label } = resolveOwnerLogin(identifier);
  const password = randomBytes(12).toString("base64url");
  let userId: string | null = null;
  let created = false;

  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (data?.user) {
    userId = data.user.id;
    created = true;
  } else if (error && /already|registered|exists/i.test(error.message)) {
    for (let page = 1; page <= 50 && !userId; page += 1) {
      const { data: list, error: listError } = await client.auth.admin.listUsers({ page, perPage: 200 });
      if (listError) throw new Error(`popis korisnika: ${listError.message}`);
      userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
      if (list.users.length < 200) break;
    }
  } else if (error) {
    throw new Error(`kreiranje korisnika: ${error.message}`);
  }
  if (!userId) throw new Error("korisnik nije pronađen niti kreiran");

  const { error: staffError } = await client.from("restaurant_staff").upsert({ user_id: userId, restaurant_id: restaurantId }, { onConflict: "user_id" });
  if (staffError) throw new Error(`restaurant_staff: ${staffError.message}`);

  console.log("");
  if (created) {
    console.log(`Račun vlasnika kreiran. Prijava na /admin/login:`);
    console.log(`  korisničko ime: ${label}`);
    console.log(`  privremena lozinka (prikazuje se SAMO sada, nigdje se ne sprema): ${password}`);
    console.log("Lozinku se kasnije mijenja u Supabase → Authentication → Users → korisnik → Update user.");
  } else {
    console.log(`Korisnik ${label} već postoji: lozinka NIJE promijenjena, samo je vezan uz radnju.`);
  }
}
