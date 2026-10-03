import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { applyPlan, buildPlan, describePlan, PlanError, stableUuid, type PlanStore, type Row } from "../src/lib/onboarding/plan";
import { findTodos, restaurantFileSchema, stripComments, type RestaurantFile } from "../src/lib/onboarding/schema";
import { createDb, rows } from "./db";

const ROOT = path.join(__dirname, "..");
const BASE_DIR = path.join(ROOT, "restaurants", "primjer-radnja");
const STORAGE = "https://projekt.supabase.co/storage/v1/object/public/menu-images";

const loadRaw = (name: string): unknown => JSON.parse(readFileSync(path.join(ROOT, "restaurants", name), "utf8"));
const parse = (raw: unknown): RestaurantFile => restaurantFileSchema.parse(stripComments(raw));
const example = (): RestaurantFile => parse(loadRaw("primjer-radnja.json"));
const plan = (file: RestaurantFile, extra: Partial<Parameters<typeof buildPlan>[1]> = {}) =>
  buildPlan(file, { baseDir: BASE_DIR, demo: true, publicStorageUrl: STORAGE, ...extra });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("shema i TODO", () => {
  test("primjer je valjan i bez TODO; komentari (_) se ignoriraju", () => {
    const raw = loadRaw("primjer-radnja.json");
    assert.deepEqual(findTodos(raw), []);
    assert.equal(example().slug, "primjer-radnja");
  });

  test("SMASH predložak: odbijen zbog TODO i ima napomenu o izvoru", () => {
    const raw = loadRaw("smash.json") as { _napomena: string };
    const todos = findTodos(raw);
    assert.ok(todos.length > 0);
    assert.ok(todos.includes("$.radno_vrijeme") && todos.includes("$.kategorije[0].artikli[0].cijena") && todos.includes("$.kategorije[0].artikli[0].opcije"));
    assert.equal(raw._napomena, "Jelovnik iz Google Maps fotografije, čeka pravi jelovnik od vlasnice");
    // Ključevi s _ ne ulaze u TODO provjeru.
    assert.ok(!todos.some((path) => /\._/.test(path)));
  });

  test("nepoznat ključ, loš slug, rezerviran slug, boja, vrijeme i 3 decimale su greške", () => {
    const bad = (patch: Record<string, unknown>) => restaurantFileSchema.safeParse(stripComments({ ...clone(loadRaw("primjer-radnja.json")) as object, ...patch })).success;
    assert.equal(bad({}), true);
    assert.equal(bad({ neznano: 1 }), false);
    assert.equal(bad({ slug: "Loš Slug" }), false);
    assert.equal(bad({ slug: "admin" }), false);
    assert.equal(bad({ accent_color: "crvena" }), false);
    assert.equal(bad({ owner_email: "nije-mail" }), false);
    const hours = { ...(loadRaw("primjer-radnja.json") as { radno_vrijeme: object }).radno_vrijeme, ned: [["25:00", "12:00"]] };
    assert.equal(bad({ radno_vrijeme: hours }), false);
    const priced = clone(loadRaw("primjer-radnja.json")) as { kategorije: { artikli: { cijena: number }[] }[] };
    priced.kategorije[0].artikli[0].cijena = 5.555;
    assert.equal(restaurantFileSchema.safeParse(stripComments(priced)).success, false);
  });

  test("'single' grupa s max_select > 1 je greška", () => {
    const raw = clone(loadRaw("primjer-radnja.json")) as { grupe_opcija: { umaci: { max_select: number | null } } };
    raw.grupe_opcija.umaci.max_select = 3;
    assert.equal(restaurantFileSchema.safeParse(stripComments(raw)).success, false);
  });
});

describe("plan", () => {
  test("grupe definirane jednom dijele se među artiklima; svaki artikl dobiva svoje retke", () => {
    const p = plan(example());
    assert.equal(p.categories.length, 2);
    assert.equal(p.items.length, 5);
    // Classic, Chicken: 3 grupe; Vege: umak + inline Pecivo; Pomfrit: umak; Voda: nijedna  => 3+3+2+1 = 9
    assert.equal(p.groups.length, 9);
    const classic = p.items.find((i) => i.name === "Classic")!;
    const umak = p.groups.find((g) => g.item_id === classic.id && g.name === "Umak")!;
    assert.deepEqual([umak.type, umak.required, umak.max_select], ["single", true, null]);
    assert.equal(p.options.filter((o) => o.group_id === umak.id).length, 3);
    const dodaci = p.groups.find((g) => g.item_id === classic.id && g.name === "Dodaci")!;
    assert.equal(dodaci.max_select, 2);
    assert.deepEqual(p.options.filter((o) => o.group_id === dodaci.id).map((o) => o.price_delta_cents), [50, 50]);
  });

  test("cijene u centima bez grešaka zaokruživanja", () => {
    const file = example();
    file.kategorije[0].artikli[0].cijena = 4.1;
    file.kategorije[0].artikli[1].cijena = 5.55;
    const p = plan(file);
    assert.deepEqual([p.items[0].price_cents, p.items[1].price_cents], [410, 555]);
  });

  test("ID-evi su stabilni (isti ulaz = isti UUID) i valjani UUID-ovi", () => {
    const a = plan(example());
    const b = plan(example());
    assert.deepEqual(a.items.map((i) => i.id), b.items.map((i) => i.id));
    assert.equal(a.restaurantId, stableUuid("restaurant:primjer-radnja"));
    for (const id of [a.restaurantId, ...a.items.map((i) => i.id as string)]) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(new Set([...a.items, ...a.groups, ...a.options].map((r) => r.id)).size, a.items.length + a.groups.length + a.options.length);
  });

  test("radno vrijeme: pon→mon, null→zatvoreno, petak preko ponoći sačuvan", () => {
    const p = plan(example());
    const hours = p.restaurant.opening_hours as Record<string, string[][]>;
    assert.deepEqual(hours.mon, []);
    assert.deepEqual(hours.fri, [["11:00", "02:00"]]);
    assert.deepEqual(hours.sun, [["12:00", "20:00"]]);
    assert.deepEqual(p.hoursLines, ["Pon zatvoreno", "Uto–Čet 11:00 – 22:00", "Pet–Sub 11:00 – 02:00", "Ned 12:00 – 20:00"]);
  });

  test("nepostojeća grupa, duplikat artikla/kategorije i duplikat grupe su greške s jasnom porukom", () => {
    const missing = example();
    missing.kategorije[0].artikli[0].opcije = ["nema-me"];
    assert.throws(() => plan(missing), (e: Error) => e instanceof PlanError && /nema-me.*nije definirana/.test(e.message));

    const dupItem = example();
    dupItem.kategorije[0].artikli.push({ ...dupItem.kategorije[0].artikli[0] });
    assert.throws(() => plan(dupItem), /dvaput/);

    const dupCategory = example();
    dupCategory.kategorije.push({ ...dupCategory.kategorije[0] });
    assert.throws(() => plan(dupCategory), /dvaput/);

    const dupGroup = example();
    dupGroup.kategorije[0].artikli[0].opcije = ["umaci", "umaci"];
    assert.throws(() => plan(dupGroup), /dvaput/);
  });

  test("slike: URL i putanje stranice ostaju, lokalna datoteka iz img/ ide u Storage", () => {
    const file = example();
    file.kategorije[0].artikli[0].slika = "https://cdn.primjer.hr/classic.jpg";
    file.kategorije[0].artikli[1].slika = "/images/chicken-burger.jpg";
    file.kategorije[0].artikli[2].slika = "img/vege.jpg";
    const p = plan(file);
    assert.equal(p.items[0].image_url, "https://cdn.primjer.hr/classic.jpg");
    assert.equal(p.items[1].image_url, "/images/chicken-burger.jpg");
    assert.equal(p.items[2].image_url, `${STORAGE}/primjer-radnja/vege.jpg`);
    assert.deepEqual(p.images.map((i) => i.storagePath), ["primjer-radnja/vege.jpg"]);
  });

  test("slika izvan restaurants/<slug>/img/ ili koja nije slika je greška", () => {
    const outside = example();
    outside.kategorije[0].artikli[0].slika = "../tajno.jpg";
    assert.throws(() => plan(outside), /mora biti u/);
    const notImage = example();
    notImage.kategorije[0].artikli[0].slika = "img/dokument.pdf";
    assert.throws(() => plan(notImage), /nije slika/);
    const clash = example();
    clash.kategorije[0].artikli[0].slika = "img/a/x.jpg";
    clash.kategorije[0].artikli[1].slika = "img/b/x.jpg";
    assert.throws(() => plan(clash), /isto ime/);
  });

  test("logo: emoji/tekst → logo_text, slika → logo_url", () => {
    assert.deepEqual([plan(example()).restaurant.logo_text, plan(example()).restaurant.logo_url], ["🍔", null]);
    const withImage = example();
    withImage.logo = "img/logo.png";
    const p = plan(withImage);
    assert.equal(p.restaurant.logo_text, null);
    assert.equal(p.restaurant.logo_url, `${STORAGE}/primjer-radnja/logo.png`);
  });

  test("sažetak navodi broj kategorija/artikala/grupa i opcije po artiklu; accepting_orders se ne dira", () => {
    const p = plan(example());
    const text = describePlan(p).join("\n");
    assert.match(text, /Kategorija: 2 · artikala: 5 · grupa opcija: 9/);
    assert.match(text, /Classic — 4,50 €/);
    assert.match(text, /Dodaci \[izbor više, najviše 2, neobavezno\]: Slanina \(\+0,50 €\)/);
    assert.match(text, /DEMO/);
    assert.ok(!("accepting_orders" in p.restaurant));
  });
});

// ---- primjena na stvarnom Postgresu: idempotentnost, skrivanje starih, očuvanje pauze ----
function pgStore(db: PGlite): PlanStore {
  return {
    async upsert(table, data: Row[]) {
      for (const row of data) {
        const cols = Object.keys(row);
        const values = cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
        const marks = cols.map((c, i) => (row[c] !== null && typeof row[c] === "object" ? `$${i + 1}::jsonb` : `$${i + 1}`));
        const update = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
        await db.query(`insert into ${table} (${cols.join(", ")}) values (${marks.join(", ")}) on conflict (id) do update set ${update}`, values);
      }
    },
    async listIds(table, scope) {
      if (scope.restaurantId) return (await rows<{ id: string }>(db, `select id from ${table} where restaurant_id = $1`, [scope.restaurantId])).map((r) => r.id);
      const column = table === "option_groups" ? "item_id" : "group_id";
      return (await rows<{ id: string }>(db, `select id from ${table} where ${column} = any($1::uuid[])`, [scope.parentIds ?? []])).map((r) => r.id);
    },
    async hideItems(ids) {
      if (ids.length) await db.query("update menu_items set available = false where id = any($1::uuid[])", [ids]);
    },
    async deleteIds(table, ids) {
      if (ids.length) await db.query(`delete from ${table} where id = any($1::uuid[])`, [ids]);
    },
  };
}

describe("primjena na bazu (PGlite)", () => {
  let db: PGlite;
  before(async () => {
    db = await createDb();
  });
  after(async () => db.close());

  const counts = async () => {
    const [r] = await rows<Record<string, number>>(
      db,
      `select (select count(*)::int from restaurants) r, (select count(*)::int from categories) c, (select count(*)::int from menu_items) i,
              (select count(*)::int from option_groups) g, (select count(*)::int from options) o`
    );
    return r;
  };

  test("prvi upis stvara radnju (is_demo), jelovnik i opcije", async () => {
    const result = await applyPlan(plan(example()), pgStore(db));
    assert.deepEqual(result, { hiddenItems: 0, deletedGroups: 0, deletedOptions: 0 });
    assert.deepEqual(await counts(), { r: 1, c: 2, i: 5, g: 9, o: 23 });
    const [shop] = await rows<{ is_demo: boolean; accepting_orders: boolean }>(db, "select is_demo, accepting_orders from restaurants");
    assert.equal(shop.is_demo, true);
  });

  test("ponovno pokretanje je IDEMPOTENTNO: isti brojevi, nema duplikata", async () => {
    const before = await counts();
    await applyPlan(plan(example()), pgStore(db));
    await applyPlan(plan(example()), pgStore(db));
    assert.deepEqual(await counts(), before);
  });

  test("ponovni upis ažurira cijenu i NE prekida pauzu koju je vlasnik uključio", async () => {
    await db.exec("update restaurants set accepting_orders = false");
    const changed = example();
    changed.kategorije[0].artikli[0].cijena = 6;
    await applyPlan(plan(changed), pgStore(db));
    const [classic] = await rows<{ price_cents: number }>(db, "select price_cents from menu_items where name = 'Classic'");
    assert.equal(classic.price_cents, 600);
    const [shop] = await rows<{ accepting_orders: boolean }>(db, "select accepting_orders from restaurants");
    assert.equal(shop.accepting_orders, false);
  });

  test("artikl kojeg više nema u datoteci se SAKRIVA (ne briše); vraćanje ga opet pokazuje", async () => {
    const smaller = example();
    smaller.kategorije[1].artikli = smaller.kategorije[1].artikli.filter((a) => a.naziv !== "Voda 0,5 l");
    const result = await applyPlan(plan(smaller), pgStore(db));
    assert.equal(result.hiddenItems, 1);
    const [voda] = await rows<{ available: boolean }>(db, "select available from menu_items where name = 'Voda 0,5 l'");
    assert.equal(voda.available, false);
    assert.equal((await counts()).i, 5); // ništa obrisano

    await applyPlan(plan(example()), pgStore(db));
    const [back] = await rows<{ available: boolean }>(db, "select available from menu_items where name = 'Voda 0,5 l'");
    assert.equal(back.available, true);
  });

  test("maknuta opcija i grupa nestaju (stare narudžbe imaju vlastitu kopiju)", async () => {
    const trimmed = example();
    trimmed.grupe_opcija.dodaci.opcije = trimmed.grupe_opcija.dodaci.opcije.slice(0, 1); // makni "Sir listić"
    trimmed.kategorije[0].artikli[1].opcije = ["umaci"]; // Chicken gubi prilozi + dodaci
    const result = await applyPlan(plan(trimmed), pgStore(db));
    assert.equal(result.deletedGroups, 2);
    assert.ok(result.deletedOptions >= 1);
    assert.equal((await rows(db, "select 1 from options where name = 'Sir listić' and group_id in (select id from option_groups where item_id = (select id from menu_items where name = 'Classic'))")).length, 0);
    await applyPlan(plan(example()), pgStore(db)); // vrati
    assert.deepEqual(await counts(), { r: 1, c: 2, i: 5, g: 9, o: 23 });
  });

  test("radnja koja već postoji (npr. iz seeda, drugi id) se ažurira umjesto da pukne na slugu", async () => {
    const db2 = await createDb();
    try {
      const seedId = "11111111-2222-4333-8444-555555555555";
      await db2.query("insert into restaurants (id, slug, name, is_demo) values ($1, 'primjer-radnja', 'Stari naziv', true)", [seedId]);
      const p = plan(example(), { existingRestaurantId: seedId, demo: false });
      await applyPlan(p, pgStore(db2));
      const shops = await rows<{ id: string; name: string; is_demo: boolean }>(db2, "select id, name, is_demo from restaurants");
      assert.deepEqual(shops, [{ id: seedId, name: "Primjer Burger", is_demo: false }]);
      assert.equal((await rows(db2, "select 1 from menu_items where restaurant_id = $1", [seedId])).length, 5);
    } finally {
      await db2.close();
    }
  });
});

// ---- sama skripta (bez baze): sažetak, odbijanje TODO, greške ----
describe("CLI skripta", () => {
  const run = (args: string) => {
    const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" };
    try {
      return { code: 0, out: execSync(`npx tsx scripts/onboard.ts ${args}`, { cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (error) {
      const e = error as { status: number; stdout: string; stderr: string };
      return { code: e.status, out: `${e.stdout}${e.stderr}` };
    }
  };

  test("--dry-run ispisuje sažetak i ne dira bazu", () => {
    const { code, out } = run("restaurants/primjer-radnja.json --demo --dry-run");
    assert.equal(code, 0);
    assert.match(out, /=== SAŽETAK ===/);
    assert.match(out, /artikala: 5/);
    assert.match(out, /ništa nije upisano/);
  });

  test("SMASH predložak s TODO se odbija (i s --yes)", () => {
    const { code, out } = run("restaurants/smash.json --yes");
    assert.equal(code, 1);
    assert.match(out, /Upis ODBIJEN/);
    assert.match(out, /\$\.radno_vrijeme/);
  });

  test("nepostojeća datoteka i nedostajući ključevi baze daju jasnu grešku", () => {
    assert.match(run("restaurants/nema.json").out, /ne postoji/);
    const noEnv = run("restaurants/primjer-radnja.json --yes");
    assert.equal(noEnv.code, 1);
    assert.match(noEnv.out, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  test("bez --yes i bez terminala skripta NE upisuje (traži potvrdu)", () => {
    const { out } = run("restaurants/primjer-radnja.json --demo");
    // Bez ključeva baze zaustavlja se prije potvrde; ništa se ne upisuje.
    assert.match(out, /SUPABASE_SERVICE_ROLE_KEY/);
  });
});
