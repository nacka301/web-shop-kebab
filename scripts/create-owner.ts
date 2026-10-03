// Račun vlasnika za VEĆ POSTOJEĆU radnju, bez JSON datoteke.
//   npm run owner -- <korisničko-ime ili e-mail> <slug>
// Koristi service role iz .env.local; ključ se nikad ne ispisuje.
import { createClient } from "@supabase/supabase-js";
import { createOwner } from "./lib/owner";

const [identifier, slug] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const fail = (message: string): never => {
  console.error(`GREŠKA: ${message}`);
  process.exit(1);
};

if (!identifier || !slug) fail("Upotreba: npm run owner -- <korisničko-ime ili e-mail> <slug>");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("Nedostaju NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY u .env.local.");

async function main() {
  const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: restaurant, error } = await client.from("restaurants").select("id, slug, name, is_demo").eq("slug", slug).maybeSingle();
  if (error) fail(error.message);
  if (!restaurant) fail(`Radnja /${slug} ne postoji u bazi.`);

  console.log(`Baza: ${new URL(url!).host}`);
  console.log(`Radnja: ${restaurant!.name} (/${restaurant!.slug}), ${restaurant!.is_demo ? "DEMO" : "prava"}`);
  await createOwner(client, identifier, restaurant!.id as string);
}

main().catch((e) => fail((e as Error).message));
