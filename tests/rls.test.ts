import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, createDb, error, rows } from "./db";

// Dvije radnje, svaka sa svojim vlasnikom. Vlasnik A ne smije ništa vidjeti ni mijenjati u radnji B.
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_A = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const OWNER_B = "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0";
const NOBODY = "99999999-9999-4999-8999-999999999999"; // prijavljen, ali bez radnje
const CAT_A = "ca000000-0000-4000-8000-00000000000a";
const CAT_B = "cb000000-0000-4000-8000-00000000000b";
const ITEM_A = "1a000000-0000-4000-8000-00000000000a";
const ITEM_B = "1b000000-0000-4000-8000-00000000000b";
const ITEM_B_HIDDEN = "1b000000-0000-4000-8000-0000000000bb";
const ORDER_A = "0a000000-0000-4000-8000-00000000000a";
const ORDER_B = "0b000000-0000-4000-8000-00000000000b";

let db: PGlite;

before(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER_A}','a@x.hr'), ('${OWNER_B}','b@x.hr'), ('${NOBODY}','n@x.hr');
    insert into restaurants (id, slug, name) values ('${A}','radnja-a','Radnja A'), ('${B}','radnja-b','Radnja B');
    insert into restaurant_staff (user_id, restaurant_id) values ('${OWNER_A}','${A}'), ('${OWNER_B}','${B}');
    insert into categories (id, restaurant_id, name) values ('${CAT_A}','${A}','Jela A'), ('${CAT_B}','${B}','Jela B');
    insert into menu_items (id, restaurant_id, category_id, name, price_cents, available) values
      ('${ITEM_A}','${A}','${CAT_A}','Burger A',500,true),
      ('${ITEM_B}','${B}','${CAT_B}','Burger B',500,true),
      ('${ITEM_B_HIDDEN}','${B}','${CAT_B}','Skriveni B',500,false);
    insert into orders (id, restaurant_id, short_code, customer_name, customer_phone, pickup_type, total_cents)
      values ('${ORDER_A}','${A}','A-111','Kupac A','+385911111111','asap',500),
             ('${ORDER_B}','${B}','B-222','Kupac B','+385922222222','asap',500);
    insert into order_items (order_id, item_id, name_snapshot, qty, unit_price_cents, line_total_cents) values
      ('${ORDER_A}','${ITEM_A}','Burger A',1,500,500), ('${ORDER_B}','${ITEM_B}','Burger B',1,500,500);
  `);
});
after(async () => db.close());

const denied = /permission denied|row-level security/i;

describe("vlasnik radnje A", () => {
  before(() => actAs(db, "authenticated", OWNER_A));

  test("čita narudžbe SAMO svoje radnje", async () => {
    const seen = await rows<{ id: string }>(db, "select id from orders");
    assert.deepEqual(seen.map((r) => r.id), [ORDER_A]);
    assert.equal((await rows(db, "select id from orders where id = $1", [ORDER_B])).length, 0);
  });

  test("čita stavke SAMO svojih narudžbi", async () => {
    const seen = await rows<{ order_id: string }>(db, "select order_id from order_items");
    assert.deepEqual(seen.map((r) => r.order_id), [ORDER_A]);
  });

  test("NE može mijenjati narudžbu radnje B (0 redaka, status ostaje)", async () => {
    const changed = await rows(db, "update orders set status = 'accepted', eta_minutes = 10 where id = $1 returning id", [ORDER_B]);
    assert.equal(changed.length, 0);
    await actAs(db, "service_role");
    assert.equal((await rows<{ status: string }>(db, "select status from orders where id = $1", [ORDER_B]))[0].status, "new");
    await actAs(db, "authenticated", OWNER_A);
  });

  test("NE može odbiti ni preuzeti tuđu narudžbu", async () => {
    for (const status of ["rejected", "ready", "done"]) {
      assert.equal((await rows(db, "update orders set status = $1 where id = $2 returning id", [status, ORDER_B])).length, 0);
    }
  });

  test("MOŽE mijenjati status svoje narudžbe (potvrda s procjenom, odbijanje s razlogom)", async () => {
    assert.equal((await rows(db, "update orders set status = 'accepted', eta_minutes = 15 where id = $1 returning id", [ORDER_A])).length, 1);
    assert.equal((await rows(db, "update orders set status = 'rejected', reject_reason = 'Nemamo više' where id = $1 returning id", [ORDER_A])).length, 1);
  });

  test("NE može mijenjati iznos, kupca ni sadržaj ni vlastite narudžbe", async () => {
    for (const col of ["total_cents = 1", "customer_phone = 'x'", "customer_name = 'x'", "restaurant_id = '" + B + "'"]) {
      const message = await error(db, `update orders set ${col} where id = $1`, [ORDER_A]);
      assert.match(message ?? "", denied, col);
    }
  });

  test("NE može stvarati ni brisati narudžbe", async () => {
    assert.match((await error(db, "insert into orders (restaurant_id, short_code, customer_name, customer_phone, pickup_type, total_cents) values ($1,'Z-1','x','x','asap',1)", [A])) ?? "", denied);
    assert.match((await error(db, "delete from orders where id = $1", [ORDER_A])) ?? "", denied);
    assert.match((await error(db, "update order_items set unit_price_cents = 1")) ?? "", denied);
  });

  test("prekidač prihvaćanja: svoju radnju DA, tuđu NE", async () => {
    assert.equal((await rows(db, "update restaurants set accepting_orders = false where id = $1 returning id", [A])).length, 1);
    assert.equal((await rows(db, "update restaurants set accepting_orders = false where id = $1 returning id", [B])).length, 0);
    await actAs(db, "service_role");
    assert.equal((await rows<{ a: boolean }>(db, "select accepting_orders a from restaurants where id = $1", [B]))[0].a, true);
    await actAs(db, "authenticated", OWNER_A);
  });

  test("NE može mijenjati slug, naziv ni is_demo svoje radnje", async () => {
    for (const col of ["slug = 'hakirano'", "name = 'x'", "is_demo = true", "opening_hours = '{}'::jsonb"]) {
      assert.match((await error(db, `update restaurants set ${col} where id = $1`, [A])) ?? "", denied, col);
    }
  });

  test("jelovnik: svoj artikl DA (cijena, naziv, stanje), tuđi NE", async () => {
    assert.equal((await rows(db, "update menu_items set price_cents = 650, name = 'Burger A+', available = false where id = $1 returning id", [ITEM_A])).length, 1);
    assert.equal((await rows(db, "update menu_items set price_cents = 1 where id = $1 returning id", [ITEM_B])).length, 0);
    assert.equal((await rows(db, "update menu_items set available = true where id = $1 returning id", [ITEM_B_HIDDEN])).length, 0);
  });

  test("vidi i svoje nedostupne artikle, ali ne tuđe nedostupne", async () => {
    const seen = (await rows<{ id: string }>(db, "select id from menu_items")).map((r) => r.id);
    assert.ok(seen.includes(ITEM_A)); // nedostupan, ali svoj
    assert.ok(!seen.includes(ITEM_B_HIDDEN)); // tuđi nedostupan
  });

  test("novi artikl: u svoju radnju i svoju kategoriju DA", async () => {
    assert.equal((await rows(db, "insert into menu_items (restaurant_id, category_id, name, description, price_cents, sort) values ($1,$2,'Novi','opis',300,5) returning id", [A, CAT_A])).length, 1);
  });

  test("novi artikl: u tuđu radnju NE, uz tuđu kategoriju NE", async () => {
    assert.match((await error(db, "insert into menu_items (restaurant_id, category_id, name, price_cents) values ($1,$2,'Napad',1)", [B, CAT_B])) ?? "", denied);
    assert.match((await error(db, "insert into menu_items (restaurant_id, category_id, name, price_cents) values ($1,$2,'Napad',1)", [A, CAT_B])) ?? "", denied);
  });

  test("NE može artikl premjestiti u tuđu kategoriju ni radnju", async () => {
    assert.match((await error(db, "update menu_items set category_id = $1 where id = $2", [CAT_B, ITEM_A])) ?? "", denied);
    assert.match((await error(db, "update menu_items set restaurant_id = $1 where id = $2", [B, ITEM_A])) ?? "", denied);
  });

  test("kategorije: svoju DA, tuđu NE", async () => {
    assert.equal((await rows(db, "update categories set name = 'Nova A' where id = $1 returning id", [CAT_A])).length, 1);
    assert.equal((await rows(db, "update categories set name = 'Hak' where id = $1 returning id", [CAT_B])).length, 0);
    assert.match((await error(db, "insert into categories (restaurant_id, name) values ($1,'Hak')", [B])) ?? "", denied);
  });

  test("restaurant_staff: vidi samo svoj redak i ne može ga mijenjati", async () => {
    const seen = await rows<{ user_id: string }>(db, "select user_id from restaurant_staff");
    assert.deepEqual(seen.map((r) => r.user_id), [OWNER_A]);
    assert.match((await error(db, "insert into restaurant_staff (user_id, restaurant_id) values ($1,$2)", [NOBODY, A])) ?? "", denied);
    assert.match((await error(db, "update restaurant_staff set restaurant_id = $1", [B])) ?? "", denied);
  });
});

describe("vlasnik radnje B je simetričan", () => {
  before(() => actAs(db, "authenticated", OWNER_B));

  test("vidi samo svoju narudžbu i ne dira tuđu", async () => {
    assert.deepEqual((await rows<{ id: string }>(db, "select id from orders")).map((r) => r.id), [ORDER_B]);
    assert.equal((await rows(db, "update orders set status = 'done' where id = $1 returning id", [ORDER_A])).length, 0);
    assert.equal((await rows(db, "update restaurants set accepting_orders = false where id = $1 returning id", [A])).length, 0);
  });
});

describe("prijavljen korisnik BEZ radnje", () => {
  before(() => actAs(db, "authenticated", NOBODY));

  test("ne vidi nijednu narudžbu ni stavku i ne mijenja ništa", async () => {
    assert.equal((await rows(db, "select id from orders")).length, 0);
    assert.equal((await rows(db, "select id from order_items")).length, 0);
    assert.equal((await rows(db, "select user_id from restaurant_staff")).length, 0);
    assert.equal((await rows(db, "update orders set status = 'done' returning id")).length, 0);
    assert.equal((await rows(db, "update menu_items set price_cents = 1 returning id")).length, 0);
    assert.equal((await rows(db, "update restaurants set accepting_orders = false returning id")).length, 0);
  });

  test("vidi samo javni jelovnik (dostupne artikle)", async () => {
    const names = (await rows<{ name: string }>(db, "select name from menu_items")).map((r) => r.name);
    assert.ok(!names.includes("Skriveni B"));
  });
});

describe("anonimni korisnik", () => {
  before(() => actAs(db, "anon"));

  test("narudžbe i stavke vraćaju prazno, restaurant_staff je nedostupan", async () => {
    assert.equal((await rows(db, "select id from orders")).length, 0);
    assert.equal((await rows(db, "select id from order_items")).length, 0);
    assert.match((await error(db, "select * from restaurant_staff")) ?? "", denied);
  });

  test("ne može mijenjati ništa", async () => {
    assert.match((await error(db, "update orders set status = 'done'")) ?? "", denied);
    assert.match((await error(db, "update menu_items set price_cents = 1")) ?? "", denied);
    assert.match((await error(db, "update restaurants set accepting_orders = false")) ?? "", denied);
  });

  test("is_staff_of nije dostupna anonu", async () => {
    assert.match((await error(db, "select is_staff_of($1)", [A])) ?? "", denied);
  });
});
