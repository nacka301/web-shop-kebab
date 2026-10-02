import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TOTAL_CENTS } from "../src/lib/orders/limits";
import { prepareOrder } from "../src/lib/orders/prepare";
import { priceCart } from "../src/lib/orders/pricing";
import { orderRequestSchema } from "../src/lib/orders/schema";
import { normalizeCroatianPhone } from "../src/lib/validation";
import { at, ids, items, restaurant } from "./fixtures";

// Utorak 2026-10-06 12:00 po Zagrebu (10:00Z) — otvoreno.
const NOW = at("2026-10-06T10:00:00Z");

const baseRequest = {
  slug: restaurant.slug,
  items: [{ item_id: ids.kebab, qty: 1, option_ids: [ids.ljuti] }],
  name: "Ivan Horvat",
  phone: "091 234 5678",
  pickup_type: "asap" as const,
};

function run(overrides: Record<string, unknown> = {}, r = restaurant, now = NOW) {
  const parsed = orderRequestSchema.parse({ ...baseRequest, ...overrides });
  return prepareOrder({ request: parsed, restaurant: r, items, now });
}

test("LAŽNA NIŽA CIJENA u zahtjevu se ignorira: server računa iz baze", () => {
  const forged = {
    ...baseRequest,
    items: [{ item_id: ids.kebab, qty: 2, option_ids: [ids.ljuti, ids.sir], price_cents: 1, unit_price_cents: 1, line_total_cents: 1 }],
    total_cents: 1,
    price: 0.01,
  };
  const parsed = orderRequestSchema.parse(forged);
  // Zod je lažna polja već odbacio…
  assert.equal("total_cents" in parsed, false);
  assert.equal("price_cents" in parsed.items[0], false);

  const result = prepareOrder({ request: parsed, restaurant, items, now: NOW });
  assert.ok(result.ok);
  // …a iznos je 2 × (5,00 + 1,00 sir) = 12,00 €, ne 0,01 €.
  assert.equal(result.order.totalCents, 1200);
  assert.equal(result.order.lines[0].unitPriceCents, 600);
});

test("cijena opcija se pribraja, a ukupno je zbroj redaka", () => {
  const result = run({
    items: [
      { item_id: ids.kebab, qty: 1, option_ids: [ids.blagi, ids.luk] },
      { item_id: ids.pice, qty: 3, option_ids: [] },
    ],
  });
  assert.ok(result.ok);
  assert.equal(result.order.totalCents, 550 + 600);
});

test("obavezna grupa mora biti odabrana", () => {
  const result = run({ items: [{ item_id: ids.kebab, qty: 1, option_ids: [] }] });
  assert.ok(!result.ok);
  assert.match(result.error, /Odaberi "Umak"/);
});

test("'single' grupa ne dopušta dva odabira", () => {
  const result = run({ items: [{ item_id: ids.kebab, qty: 1, option_ids: [ids.ljuti, ids.blagi] }] });
  assert.ok(!result.ok);
  assert.match(result.error, /samo jedna opcija/);
});

test("max_select je poštovan", () => {
  const result = run({ items: [{ item_id: ids.kebab, qty: 1, option_ids: [ids.ljuti, ids.sir, ids.luk] }] });
  assert.ok(!result.ok);
  assert.match(result.error, /najviše 1/);
});

test("opcija koja ne pripada artiklu se odbija", () => {
  assert.ok(!run({ items: [{ item_id: ids.salata, qty: 1, option_ids: [ids.ljuti] }] }).ok);
});

test("nedostupan artikl: jasna poruka", () => {
  const result = run({ items: [{ item_id: ids.nedostupno, qty: 1, option_ids: [] }] });
  assert.ok(!result.ok);
  assert.equal(result.error, "Artikl Pikito sendvič više nije dostupan.");
});

test("artikl iz tuđe radnje (nepoznat id) se odbija", () => {
  assert.ok(!run({ items: [{ item_id: "99999999-9999-4999-8999-999999999999", qty: 1, option_ids: [] }] }).ok);
});

test("ograničenja količine: 20 po stavci, 30 ukupno, 300 EUR", () => {
  assert.throws(() => orderRequestSchema.parse({ ...baseRequest, items: [{ item_id: ids.pice, qty: 21, option_ids: [] }] }));
  const thirtyOne = priceCart(items, [
    { itemId: ids.pice, qty: 20, optionIds: [] },
    { itemId: ids.pice, qty: 11, optionIds: [] },
  ]);
  assert.ok(!thirtyOne.ok);
  const expensive = priceCart([{ ...items[2], priceCents: MAX_TOTAL_CENTS }], [{ itemId: ids.pice, qty: 2, optionIds: [] }]);
  assert.ok(!expensive.ok);
  assert.match(expensive.error, /300,00 €/);
});

test("demo radnja ne prima prave narudžbe", () => {
  const result = run({}, { ...restaurant, isDemo: true });
  assert.ok(!result.ok);
  assert.equal(result.status, 403);
});

test("radnja koja ne prima narudžbe", () => {
  const result = run({}, { ...restaurant, acceptingOrders: false });
  assert.ok(!result.ok);
  assert.equal(result.error, "Radnja trenutno ne prima narudžbe.");
});

test("'što prije' kad je radnja zatvorena (utorak 03:00)", () => {
  const result = run({}, restaurant, at("2026-10-06T01:00:00Z"));
  assert.ok(!result.ok);
  assert.equal(result.error, "Radnja je trenutno zatvorena.");
});

test("zakazano vrijeme: budućnost, radno vrijeme, najviše 24 h", () => {
  const ok = run({ pickup_type: "time", pickup_time: "2026-10-06T16:00:00Z" }); // 18:00
  assert.ok(ok.ok);
  assert.equal(ok.order.pickupTime?.toISOString(), "2026-10-06T16:00:00.000Z");

  assert.ok(!run({ pickup_type: "time", pickup_time: "2026-10-06T09:00:00Z" }).ok); // prošlost
  assert.ok(!run({ pickup_type: "time", pickup_time: "2026-10-07T12:00:00Z" }).ok); // > 24 h
  assert.ok(!run({ pickup_type: "time", pickup_time: "2026-10-06T22:00:00Z" }).ok); // 00:00 utorak→srijeda, zatvoreno
  assert.ok(!run({ pickup_type: "time" }).ok); // bez vremena
});

test("zakazano poslije ponoći u petak (subota 01:00) je dopušteno", () => {
  const friday = at("2026-10-02T21:30:00Z"); // petak 23:30
  const result = run({ pickup_type: "time", pickup_time: "2026-10-02T23:00:00Z" }, restaurant, friday);
  assert.ok(result.ok);
});

test("telefon se normalizira na +385", () => {
  for (const raw of ["091 234 5678", "091-234-5678", "+385 91 234 5678", "00385912345678", "0912345678"]) {
    assert.equal(normalizeCroatianPhone(raw), "+385912345678", raw);
  }
  assert.equal(normalizeCroatianPhone("0112345678"), null);
  assert.equal(normalizeCroatianPhone("abc"), null);
  const result = run({ phone: "12345" });
  assert.ok(!result.ok);
  assert.equal(result.error, "Unesi ispravan broj mobitela.");
});

test("zod: ime 2–60 znakova, napomena do 300", () => {
  assert.throws(() => orderRequestSchema.parse({ ...baseRequest, name: "I" }));
  assert.throws(() => orderRequestSchema.parse({ ...baseRequest, name: "x".repeat(61) }));
  assert.throws(() => orderRequestSchema.parse({ ...baseRequest, note: "x".repeat(301) }));
});
