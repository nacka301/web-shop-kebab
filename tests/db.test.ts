import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, createDb, error, rows } from "./db";

const SEED = readFileSync(join(__dirname, "..", "supabase", "seed.sql"), "utf8");
const TEST_RESTAURANT = readFileSync(join(__dirname, "..", "supabase", "test-restaurant.sql"), "utf8");
const RID = "00000000-0000-4000-8000-0000000000a1";
const denied = /permission denied|row-level security/i;

let db: PGlite;
before(async () => {
  db = await createDb();
  await db.exec(SEED);
  await db.exec(SEED); // idempotentno
  await db.exec(TEST_RESTAURANT);
  await db.exec(TEST_RESTAURANT);
});
after(async () => db.close());

const createOrder = (items: unknown[], total = 250) =>
  db.query<{ order_id: string; short_code: string }>("select * from create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)", [
    RID, "Ivan Horvat", "+385912345678", "asap", null, "bez luka", "qr", "hash", total, JSON.stringify(items),
  ]);
const line = { item_id: null, name: "Pomfrit", qty: 1, unit_price_cents: 250, line_total_cents: 250, options: [] };

test("seed: tri demo radnje + test radnja koja nije demo", async () => {
  await actAs(db, null);
  const shops = await rows<{ slug: string; is_demo: boolean }>(db, "select slug, is_demo from restaurants order by slug");
  assert.deepEqual(shops.map((s) => `${s.slug}:${s.is_demo}`), ["emmito:true", "grill-box:true", "smash:true", "test-radnja:false"]);
});

test("seed: Emmito jelovnik, cijene, umak obavezan osim za salatu i vege sendvič, satnica", async () => {
  await actAs(db, null);
  const prices = await rows<{ price_cents: number }>(db, "select price_cents from menu_items where restaurant_id = (select id from restaurants where slug='emmito') order by sort");
  assert.deepEqual(prices.map((p) => p.price_cents), [650, 500, 400, 550, 500, 300, 400, 200]);
  const optional = await rows<{ name: string }>(db, "select mi.name from option_groups og join menu_items mi on mi.id = og.item_id where mi.restaurant_id = (select id from restaurants where slug='emmito') and not og.required order by mi.sort");
  assert.deepEqual(optional.map((o) => o.name), ["Kebab salata", "Vege sendvič"]);
  const [{ h }] = await rows<{ h: Record<string, string[][]> }>(db, "select opening_hours h from restaurants where slug='emmito'");
  assert.deepEqual(h.fri, [["09:00", "02:00"]]);
  assert.deepEqual(h.sun, [["16:00", "22:00"]]);
});

test("create_order: narudžba i stavke u jednoj transakciji, kod oblika A-482", async () => {
  await actAs(db, "service_role");
  const { rows: created } = await createOrder([line, { ...line, name: "Burger", unit_price_cents: 500, line_total_cents: 500 }], 750);
  assert.match(created[0].short_code, /^[A-Z]-\d{3}$/);
  const [saved] = await rows<{ n: number; status: string }>(db, "select (select count(*)::int from order_items where order_id = o.id) n, status from orders o where id = $1", [created[0].order_id]);
  assert.equal(saved.n, 2);
  assert.equal(saved.status, "new");
});

test("create_order: neispravna stavka poništava CIJELU narudžbu", async () => {
  await actAs(db, "service_role");
  const [{ n: before }] = await rows<{ n: number }>(db, "select count(*)::int n from orders");
  await assert.rejects(createOrder([{ ...line, qty: 0 }]));
  const [{ n: after }] = await rows<{ n: number }>(db, "select count(*)::int n from orders");
  assert.equal(after, before);
});

test("create_order: kodovi su jedinstveni po radnji za dan", async () => {
  await actAs(db, "service_role");
  for (let i = 0; i < 40; i += 1) await createOrder([line]);
  const [counts] = await rows<{ total: number; uniq: number }>(db, "select count(*)::int total, count(distinct short_code)::int uniq from orders where restaurant_id = $1", [RID]);
  assert.equal(counts.total, counts.uniq);
});

test("anon: čita radnje i jelovnik, ali narudžbe vraćaju PRAZNO iako ih ima", async () => {
  await actAs(db, "service_role");
  const [{ n }] = await rows<{ n: number }>(db, "select count(*)::int n from orders");
  assert.ok(n > 0);
  await actAs(db, "anon");
  assert.equal((await rows(db, "select id from restaurants")).length, 4);
  assert.ok((await rows(db, "select id from menu_items")).length > 0);
  assert.ok((await rows(db, "select id from options")).length > 0);
  assert.equal((await rows(db, "select id from orders")).length, 0);
  assert.equal((await rows(db, "select id from order_items")).length, 0);
});

test("anon ne može pisati niti zvati create_order", async () => {
  await actAs(db, "anon");
  assert.match((await error(db, "insert into orders (restaurant_id, short_code, customer_name, customer_phone, pickup_type, total_cents) values ($1,'Z-9','x','x','asap',1)", [RID])) ?? "", denied);
  assert.match((await error(db, "delete from restaurants")) ?? "", denied);
  assert.match((await error(db, "select * from create_order($1,'x','x','asap',null,'',null,'h',1,'[]'::jsonb)", [RID])) ?? "", denied);
});

test("nedostupan artikl je skriven anonu, service_role ga vidi", async () => {
  await actAs(db, "service_role");
  await db.exec("update menu_items set available = false where id = '00000000-0000-4000-8000-0000000000c2'");
  assert.equal((await rows(db, "select id from menu_items where id = '00000000-0000-4000-8000-0000000000c2'")).length, 1);
  await actAs(db, "anon");
  assert.equal((await rows(db, "select id from menu_items where id = '00000000-0000-4000-8000-0000000000c2'")).length, 0);
});

test("ograničenja: url-siguran slug, status iz skupa, 'time' traži pickup_time", async () => {
  await actAs(db, "service_role");
  assert.ok(await error(db, "insert into restaurants (slug, name) values ('Loš Slug','x')"));
  assert.ok(await error(db, "update orders set status = 'cooking'"));
  assert.ok(await error(db, "insert into orders (restaurant_id, short_code, customer_name, customer_phone, pickup_type, total_cents) values ($1,'Y-1','x','x','time',1)", [RID]));
});
