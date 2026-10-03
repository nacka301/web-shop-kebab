import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, createDb, error, rows } from "./db";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_A = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const denied = /permission denied|row-level security/i;

let db: PGlite;
before(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER_A}');
    insert into restaurants (id, slug, name) values ('${A}','a','A'), ('${B}','b','B');
    insert into restaurant_staff values ('${OWNER_A}','${A}');
  `);
});
after(async () => db.close());

const bump = (rid: string, src: string) => db.query("select increment_page_view($1, $2)", [rid, src]);

test("brojač: jedan redak po radnji, danu i izvoru, UPSERT povećava", async () => {
  await actAs(db, "service_role");
  for (let i = 0; i < 5; i += 1) await bump(A, "qr");
  await bump(A, "ig");
  await bump(B, "qr");
  const all = await rows<{ src: string; views: number }>(db, "select src, views from page_views where restaurant_id = $1 order by src", [A]);
  assert.deepEqual(all, [{ src: "ig", views: 1 }, { src: "qr", views: 5 }]);
});

test("nepoznat izvor se sprema kao 'other' (nikad sirov tekst)", async () => {
  await actAs(db, "service_role");
  await bump(A, "tiktok'; drop table orders;--");
  const [row] = await rows<{ views: number }>(db, "select views from page_views where restaurant_id = $1 and src = 'other'", [A]);
  assert.equal(row.views, 1);
  assert.ok(await error(db, "insert into page_views (restaurant_id, day, src) values ($1, current_date, 'tiktok')", [A]));
});

test("ne sprema se ništa osobno: samo radnja, dan, izvor i zbroj", async () => {
  await actAs(db, "service_role");
  const columns = await rows<{ column_name: string }>(db, "select column_name from information_schema.columns where table_name = 'page_views' order by column_name");
  assert.deepEqual(columns.map((c) => c.column_name), ["day", "restaurant_id", "src", "views"]);
});

test("anonimac NE čita page_views niti zove funkciju", async () => {
  await actAs(db, "anon");
  assert.match((await error(db, "select * from page_views")) ?? "", denied);
  assert.match((await error(db, "select increment_page_view($1,'qr')", [A])) ?? "", denied);
});

test("vlasnik čita SAMO posjete svoje radnje i ne može ih mijenjati", async () => {
  await actAs(db, "authenticated", OWNER_A);
  const seen = await rows<{ restaurant_id: string }>(db, "select distinct restaurant_id from page_views");
  assert.deepEqual(seen.map((r) => r.restaurant_id), [A]);
  assert.match((await error(db, "update page_views set views = 9999")) ?? "", denied);
  assert.match((await error(db, "insert into page_views (restaurant_id, day, src, views) values ($1, current_date, 'qr', 5)", [A])) ?? "", denied);
  assert.match((await error(db, "delete from page_views")) ?? "", denied);
  assert.match((await error(db, "select increment_page_view($1,'qr')", [A])) ?? "", denied);
});

test("izvor narudžbe: samo iz popisa ili prazan", async () => {
  await actAs(db, "service_role");
  const insert = (source: string | null) =>
    error(db, "insert into orders (restaurant_id, short_code, customer_name, customer_phone, pickup_type, total_cents, source) values ($1, $2, 'x', 'x', 'asap', 1, $3)", [A, `Q-${Math.floor(Math.random() * 900) + 100}`, source]);
  assert.equal(await insert("qr"), null);
  assert.equal(await insert(null), null);
  assert.ok(await insert("neki-izvor"));
});
