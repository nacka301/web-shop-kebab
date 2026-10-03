import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, createDb, error, rows } from "./db";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_A = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const OWNER_B = "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0";
const denied = /permission denied|row-level security/i;

let db: PGlite;
before(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id) values ('${OWNER_A}'), ('${OWNER_B}');
    insert into restaurants (id, slug, name, owner_email) values ('${A}','a','A','a@vlasnik.hr'), ('${B}','b','B','b@vlasnik.hr');
    insert into restaurant_staff values ('${OWNER_A}','${A}'), ('${OWNER_B}','${B}');
  `);
});
after(async () => db.close());

test("anonimac čita javne stupce, ali NE owner_email (ni izravno ni sa *)", async () => {
  await actAs(db, "anon");
  assert.equal((await rows(db, "select id, slug, name from restaurants")).length, 2);
  assert.match((await error(db, "select owner_email from restaurants")) ?? "", denied);
  assert.match((await error(db, "select * from restaurants")) ?? "", denied);
  assert.match((await error(db, "select id from restaurants where owner_email = 'a@vlasnik.hr'")) ?? "", denied);
});

test("ni prijavljeni vlasnik druge radnje ne čita owner_email", async () => {
  await actAs(db, "authenticated", OWNER_B);
  assert.match((await error(db, "select owner_email from restaurants")) ?? "", denied);
  assert.match((await error(db, "select owner_email from restaurants where id = $1", [A])) ?? "", denied);
});

test("vlasnik svoj e-mail čita kroz funkciju; za tuđu radnju dobiva null; anon ne smije zvati", async () => {
  await actAs(db, "authenticated", OWNER_A);
  assert.equal((await rows<{ e: string }>(db, "select get_owner_email($1) e", [A]))[0].e, "a@vlasnik.hr");
  assert.equal((await rows<{ e: string | null }>(db, "select get_owner_email($1) e", [B]))[0].e, null);
  await actAs(db, "anon");
  assert.match((await error(db, "select get_owner_email($1)", [A])) ?? "", denied);
});

test("vlasnik mijenja e-mail SVOJE radnje, ne tuđe; loš oblik odbija baza", async () => {
  await actAs(db, "authenticated", OWNER_A);
  assert.equal((await rows(db, "update restaurants set owner_email = 'novi@vlasnik.hr' where id = $1 returning id", [A])).length, 1);
  assert.equal((await rows(db, "update restaurants set owner_email = 'hak@x.hr' where id = $1 returning id", [B])).length, 0);
  assert.equal((await rows<{ e: string }>(db, "select get_owner_email($1) e", [A]))[0].e, "novi@vlasnik.hr");
  for (const bad of ["nije-mail", "a@b", "a b@c.hr", "@x.hr"]) {
    assert.match((await error(db, "update restaurants set owner_email = $1 where id = $2", [bad, A])) ?? "", /check constraint|violates/i, bad);
  }
  assert.equal((await rows(db, "update restaurants set owner_email = null where id = $1 returning id", [A])).length, 1);
});

test("service_role (server) čita owner_email za slanje obavijesti", async () => {
  await actAs(db, "service_role");
  const found = await rows<{ owner_email: string }>(db, "select owner_email from restaurants where id = $1", [B]);
  assert.equal(found[0].owner_email, "b@vlasnik.hr");
});
