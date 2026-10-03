import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, createDb, error, rows } from "./db";

const TEST_RESTAURANT = readFileSync(join(__dirname, "..", "supabase", "test-restaurant.sql"), "utf8");
const RID = "00000000-0000-4000-8000-0000000000a1";

let db: PGlite;
before(async () => {
  db = await createDb();
  await db.exec(TEST_RESTAURANT);
});
after(async () => db.close());

const line = JSON.stringify([{ item_id: null, name: "Pomfrit", qty: 1, unit_price_cents: 250, line_total_cents: 250, options: [] }]);
const order = (ip: string, max: number) =>
  db.query("select * from create_order($1,'Ivan','+385912345678','asap',null,'','qr',$2,250,$3::jsonb,$4,10)", [RID, ip, line, max]);

test("ograničenje po IP-u radi u funkciji: 5 prolazi, šesta se odbija", async () => {
  await actAs(db, "service_role");
  for (let i = 0; i < 5; i += 1) await order("ip-a", 5);
  assert.match((await error(db, "select * from create_order($1,'Ivan','+385912345678','asap',null,'','qr','ip-a',250,$2::jsonb,5,10)", [RID, line])) ?? "", /rate_limited/);
  const [{ n }] = await rows<{ n: string }>(db, "select count(*) n from orders where ip_hash = 'ip-a'");
  assert.equal(Number(n), 5);
});

test("druga IP adresa nije pogođena, a bez granice (0) nema ograničenja", async () => {
  await actAs(db, "service_role");
  await order("ip-b", 5);
  for (let i = 0; i < 8; i += 1) await order("ip-nolimit", 0);
  const [{ n }] = await rows<{ n: string }>(db, "select count(*) n from orders where ip_hash = 'ip-nolimit'");
  assert.equal(Number(n), 8);
});

test("odbijena narudžba ne ostavlja stavke (transakcija se poništava)", async () => {
  await actAs(db, "service_role");
  const before = await rows<{ n: string }>(db, "select count(*) n from order_items");
  await error(db, "select * from create_order($1,'Ivan','+385912345678','asap',null,'','qr','ip-a',250,$2::jsonb,5,10)", [RID, line]);
  const afterCount = await rows<{ n: string }>(db, "select count(*) n from order_items");
  assert.equal(before[0].n, afterCount[0].n);
});

test("status 'cancelled' je dopušten, nepoznat status nije", async () => {
  await actAs(db, "service_role");
  const [{ id }] = await rows<{ id: string }>(db, "select id from orders limit 1");
  await db.query("update orders set status = 'cancelled' where id = $1", [id]);
  assert.match((await error(db, "update orders set status = 'poništeno' where id = $1", [id])) ?? "", /check constraint|violates/i);
});
