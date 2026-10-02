// Dodavanje/ažuriranje radnje iz jedne JSON datoteke.
//   npm run onboard -- restaurants/smash.json [--yes] [--demo] [--create-owner] [--dry-run]
// Koristi service role iz .env.local; ključ se nikad ne ispisuje.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyPlan, buildPlan, describePlan, PlanError, type Plan, type PlanStore, type PlanTable, type Row } from "../src/lib/onboarding/plan";
import { findTodos, formatZodIssues, restaurantFileSchema, stripComments } from "../src/lib/onboarding/schema";

const BUCKET = "menu-images";
const CHUNK = 100;
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const fail = (message: string, details: string[] = []): never => {
  console.error(`\nGREŠKA: ${message}`);
  for (const line of details) console.error(`  - ${line}`);
  process.exit(1);
};

const chunks = <T>(list: T[]): T[][] => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

function supabaseStore(client: SupabaseClient): PlanStore {
  const check = (error: { message: string } | null, what: string) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };
  return {
    async upsert(table: PlanTable, rows: Row[]) {
      for (const part of chunks(rows)) check((await client.from(table).upsert(part, { onConflict: "id" })).error, `upis u ${table}`);
    },
    async listIds(table, scope) {
      if (scope.restaurantId) {
        const { data, error } = await client.from(table).select("id").eq("restaurant_id", scope.restaurantId);
        check(error, `čitanje ${table}`);
        return (data ?? []).map((r) => r.id as string);
      }
      const column = table === "option_groups" ? "item_id" : "group_id";
      const ids: string[] = [];
      for (const part of chunks(scope.parentIds ?? [])) {
        const { data, error } = await client.from(table).select("id").in(column, part);
        check(error, `čitanje ${table}`);
        ids.push(...(data ?? []).map((r) => r.id as string));
      }
      return ids;
    },
    async hideItems(ids) {
      for (const part of chunks(ids)) check((await client.from("menu_items").update({ available: false }).in("id", part)).error, "skrivanje starih artikala");
    },
    async deleteIds(table, ids) {
      for (const part of chunks(ids)) check((await client.from(table).delete().in("id", part)).error, `brisanje starih zapisa iz ${table}`);
    },
  };
}

async function uploadImages(client: SupabaseClient, plan: Plan) {
  for (const image of plan.images) {
    const body = readFileSync(image.file);
    const { error } = await client.storage.from(BUCKET).upload(image.storagePath, body, {
      upsert: true,
      contentType: CONTENT_TYPES[path.extname(image.file).toLowerCase()] ?? "application/octet-stream",
    });
    if (error) throw new Error(`upload slike ${image.storagePath}: ${error.message}`);
  }
}

// Kreira Supabase Auth korisnika (ako ga nema) i veže ga uz radnju. Lozinka se ispiše SAMO jednom u terminal.
async function createOwner(client: SupabaseClient, email: string, restaurantId: string) {
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
    console.log(`Račun vlasnika kreiran: ${email}`);
    console.log(`Privremena lozinka (prikazuje se SAMO sada, nigdje se ne sprema): ${password}`);
    console.log("Lozinku treba promijeniti pri prvoj prijavi (Supabase → Authentication → Users → korisnik → Send password recovery).");
  } else {
    console.log(`Korisnik ${email} već postoji: lozinka NIJE promijenjena, samo je vezan uz radnju.`);
  }
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return answer === "da" || answer === "d" || answer === "y" || answer === "yes";
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const fileArg = args.find((a) => !a.startsWith("--"));
  if (!fileArg) fail("Navedi datoteku: npm run onboard -- restaurants/<slug>.json [--yes] [--demo] [--create-owner] [--dry-run]");

  const filePath = path.resolve(fileArg!);
  if (!existsSync(filePath)) fail(`Datoteka ne postoji: ${fileArg}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    return fail(`Datoteka nije valjan JSON: ${(error as Error).message}`);
  }

  // 1) Nepotvrđeni podaci: dok postoji ijedan TODO, upis je zabranjen.
  const todos = findTodos(raw);
  if (todos.length > 0) {
    const note = (raw as { _napomena?: string })?._napomena;
    if (note) console.error(`Napomena u datoteci: ${note}`);
    fail(`Upis ODBIJEN: datoteka još sadrži ${todos.length} nepotvrđenih "TODO" mjesta. Ispuni ih pa pokreni ponovno.`, todos);
  }

  // 2) Shema.
  const parsed = restaurantFileSchema.safeParse(stripComments(raw));
  if (!parsed.success) fail("Datoteka nije ispravna:", formatZodIssues(parsed.error));
  const file = parsed.data!;

  // 3) Plan (provjere grupa opcija, duplikata, slika).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = flags.has("--dry-run");
  if (!dryRun && (!supabaseUrl || !serviceKey)) fail("Nedostaju NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY u .env.local.");
  const client = !dryRun ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  let existing: { id: string; is_demo: boolean } | null = null;
  if (client) {
    const { data, error } = await client.from("restaurants").select("id, is_demo").eq("slug", file.slug).maybeSingle();
    if (error) fail(`Čitanje baze nije uspjelo: ${error.message}`);
    existing = data as { id: string; is_demo: boolean } | null;
  }

  let plan: Plan;
  try {
    plan = buildPlan(file, {
      baseDir: path.join(path.dirname(filePath), file.slug),
      demo: flags.has("--demo"),
      publicStorageUrl: `${supabaseUrl ?? "https://<projekt>.supabase.co"}/storage/v1/object/public/${BUCKET}`,
      existingRestaurantId: existing?.id,
    });
  } catch (error) {
    return fail((error instanceof PlanError ? error : (error as Error)).message);
  }
  const missingImages = plan.images.filter((image) => !existsSync(image.file));
  if (missingImages.length > 0) fail("Slike navedene u datoteci ne postoje:", missingImages.map((i) => path.relative(process.cwd(), i.file)));
  if (flags.has("--create-owner") && !plan.ownerEmail) fail('--create-owner traži "owner_email" u datoteci.');

  // 4) SAŽETAK.
  console.log("\n=== SAŽETAK ===");
  if (supabaseUrl) console.log(`Baza: ${new URL(supabaseUrl).host}`);
  console.log(
    existing
      ? `Radnja /${plan.slug} već postoji — bit će AŽURIRANA (${existing.is_demo ? "trenutno DEMO" : "trenutno prava"} → ${plan.isDemo ? "DEMO" : "prava"}).`
      : `Radnja /${plan.slug} je NOVA.`
  );
  for (const line of describePlan(plan)) console.log(line);
  if (flags.has("--create-owner")) console.log(`\nKreirat će se račun vlasnika za ${plan.ownerEmail}.`);
  console.log("\nArtikli kojih nema u datoteci bit će SAKRIVENI (ne brišu se).");

  if (dryRun) {
    console.log("\n--dry-run: ništa nije upisano.");
    return;
  }

  // 5) Potvrda pa upis.
  if (!flags.has("--yes") && !(await confirm("\nUpisati u bazu? (da/ne) "))) {
    console.log("Prekinuto, ništa nije upisano.");
    process.exit(2);
  }

  try {
    await uploadImages(client!, plan);
    const result = await applyPlan(plan, supabaseStore(client!));
    console.log(`\nGotovo. Sakriveno starih artikala: ${result.hiddenItems}, uklonjenih starih grupa/opcija: ${result.deletedGroups}/${result.deletedOptions}.`);
    if (flags.has("--create-owner")) await createOwner(client!, plan.ownerEmail!, plan.restaurantId);
  } catch (error) {
    fail((error as Error).message);
  }
}

main().catch((error) => fail((error as Error).message));
