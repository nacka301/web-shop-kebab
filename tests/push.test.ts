import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildNewOrderPush } from "../src/lib/push/payload";
import { sendPushToRestaurant, type PushSender } from "../src/lib/push/send";
import { actAs, createDb, error, rows } from "./db";

test("obavijest ne sadrži ime ni telefon gosta, samo kod, broj stavki i iznos", () => {
  const payload = buildNewOrderPush({ shortCode: "M-214", itemCount: 3, totalCents: 1250 });
  assert.equal(payload.title, "Nova narudžba M-214");
  assert.equal(payload.body, "3 stavke · 12,50 €");
  assert.equal(payload.url, "/admin");
  assert.equal(buildNewOrderPush({ shortCode: "A-1", itemCount: 1, totalCents: 500 }).body, "1 stavka · 5,00 €");
  assert.equal(buildNewOrderPush({ shortCode: "A-1", itemCount: 5, totalCents: 500 }).body, "5 stavki · 5,00 €");
});

// Minimalni lažni Supabase klijent: select vraća pretplate, delete bilježi obrisane id-eve.
function fakeClient(subs: { id: string; endpoint: string; p256dh: string; auth: string }[]) {
  const deleted: string[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: subs, error: null }) }),
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          deleted.push(...ids);
          return { error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, deleted };
}

describe("slanje obavijesti", () => {
  const subs = [
    { id: "1", endpoint: "https://push.example/ok", p256dh: "k", auth: "a" },
    { id: "2", endpoint: "https://push.example/gone", p256dh: "k", auth: "a" },
    { id: "3", endpoint: "https://push.example/down", p256dh: "k", auth: "a" },
  ];
  const payload = buildNewOrderPush({ shortCode: "M-1", itemCount: 1, totalCents: 500 });

  test("uspjeh se broji, istekle pretplate (410) se brišu, privremene greške ostaju", async () => {
    const { client, deleted } = fakeClient(subs);
    const sender: PushSender = async ({ endpoint }) => {
      if (endpoint.endsWith("/gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (endpoint.endsWith("/down")) throw Object.assign(new Error("down"), { statusCode: 503 });
    };
    const result = await sendPushToRestaurant(client, "r1", payload, sender);
    assert.deepEqual(result, { sent: 1, removed: 1, failed: 1 });
    assert.deepEqual(deleted, ["2"]);
  });

  test("nema pretplata = nema slanja i nema greške", async () => {
    const { client } = fakeClient([]);
    const result = await sendPushToRestaurant(client, "r1", payload, async () => assert.fail("ne smije slati"));
    assert.deepEqual(result, { sent: 0, removed: 0, failed: 0 });
  });

  test("sadržaj koji ide uređaju je JSON obavijesti", async () => {
    const { client } = fakeClient([subs[0]]);
    let body = "";
    await sendPushToRestaurant(client, "r1", payload, async (_s, b) => {
      body = b;
    });
    assert.deepEqual(JSON.parse(body), payload);
  });
});

describe("push_subscriptions u bazi (RLS)", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const OWNER_A = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
  const OWNER_B = "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0";
  let db: PGlite;

  before(async () => {
    db = await createDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${OWNER_A}','a@x.hr'), ('${OWNER_B}','b@x.hr');
      insert into restaurants (id, slug, name) values ('${A}','radnja-a','A'), ('${B}','radnja-b','B');
      insert into restaurant_staff (user_id, restaurant_id) values ('${OWNER_A}','${A}'), ('${OWNER_B}','${B}');
      insert into push_subscriptions (restaurant_id, user_id, endpoint, p256dh, auth)
        values ('${B}','${OWNER_B}','https://push.example/b','k','a');
    `);
  });
  after(async () => db.close());

  const INSERT = "insert into push_subscriptions (restaurant_id, user_id, endpoint, p256dh, auth) values ($1,$2,$3,'k','a')";
  const add = (restaurant: string, user: string, endpoint: string) =>
    db.query("insert into push_subscriptions (restaurant_id, user_id, endpoint, p256dh, auth) values ($1,$2,$3,'k','a')", [restaurant, user, endpoint]);

  test("vlasnik A dodaje pretplatu za SVOJU radnju", async () => {
    await actAs(db, "authenticated", OWNER_A);
    await add(A, OWNER_A, "https://push.example/a");
    assert.equal((await rows(db, "select id from push_subscriptions")).length, 1);
  });

  test("vlasnik A NE može dodati pretplatu za radnju B ni u tuđe ime", async () => {
    await actAs(db, "authenticated", OWNER_A);
    assert.match((await error(db, INSERT, [B, OWNER_A, "https://push.example/x1"])) ?? "", /row-level security/i);
    assert.match((await error(db, INSERT, [A, OWNER_B, "https://push.example/x2"])) ?? "", /row-level security/i);
  });

  test("vlasnik A ne vidi i ne briše pretplate radnje B", async () => {
    await actAs(db, "authenticated", OWNER_A);
    assert.equal((await rows(db, "select id from push_subscriptions where restaurant_id = $1", [B])).length, 0);
    await db.query("delete from push_subscriptions where restaurant_id = $1", [B]);
    await actAs(db, "service_role");
    assert.equal((await rows(db, "select id from push_subscriptions where restaurant_id = $1", [B])).length, 1);
  });

  test("anonimac nema pristup, a endpoint mora biti https", async () => {
    await actAs(db, "anon");
    assert.match((await error(db, "select * from push_subscriptions")) ?? "", /permission denied/i);
    await actAs(db, "service_role");
    assert.match((await error(db, INSERT, [A, OWNER_A, "http://nije-https"])) ?? "", /check constraint|violates/i);
  });
});
