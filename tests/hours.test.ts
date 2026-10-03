import assert from "node:assert/strict";
import { test } from "node:test";
import { formatHoursLines, isWithinWorkingHours, openStatusLabel, pickupSlots, formatTime } from "../src/lib/hours";
import { at, emmitoHours } from "./fixtures";

const shop = { tjedno: emmitoHours };

// Ljeto: Zagreb = UTC+2. Petak 2026-10-02, subota 2026-10-03, nedjelja 2026-10-04.
test("petak 23:30 je otvoreno", () => {
  assert.equal(isWithinWorkingHours(shop, at("2026-10-02T21:30:00Z")), true);
  assert.equal(openStatusLabel(shop, at("2026-10-02T21:30:00Z")), "Otvoreno do 02:00");
});

test("subota 01:00 je još otvoreno (iz petkovog intervala)", () => {
  assert.equal(isWithinWorkingHours(shop, at("2026-10-02T23:00:00Z")), true);
  assert.equal(openStatusLabel(shop, at("2026-10-02T23:00:00Z")), "Otvoreno do 02:00");
});

test("subota 02:00 zatvara, do 09:00 je zatvoreno", () => {
  assert.equal(isWithinWorkingHours(shop, at("2026-10-03T00:00:00Z")), false);
  assert.equal(openStatusLabel(shop, at("2026-10-03T01:00:00Z")), "Zatvoreno · otvara u 09:00");
});

test("subota 09:30 po Zagrebu je otvoreno, i kad je na serveru (UTC) tek 07:30", () => {
  assert.equal(isWithinWorkingHours(shop, at("2026-10-03T07:30:00Z")), true);
});

test("nedjelja 01:00 je otvoreno iz subote, ponedjeljak 01:00 NIJE (nedjelja ne prelazi ponoć)", () => {
  assert.equal(isWithinWorkingHours(shop, at("2026-10-03T23:00:00Z")), true);
  assert.equal(isWithinWorkingHours(shop, at("2026-10-04T23:00:00Z")), false);
});

test("nedjelja: otvara 16:00, zatvara 22:00", () => {
  assert.equal(isWithinWorkingHours(shop, at("2026-10-04T13:59:00Z")), false);
  assert.equal(isWithinWorkingHours(shop, at("2026-10-04T14:00:00Z")), true);
  assert.equal(isWithinWorkingHours(shop, at("2026-10-04T20:00:00Z")), false);
  assert.equal(openStatusLabel(shop, at("2026-10-04T10:00:00Z")), "Zatvoreno · otvara u 16:00");
});

test("zimsko vrijeme (UTC+1): petak 23:30 CET = 22:30Z je otvoreno", () => {
  assert.equal(isWithinWorkingHours(shop, at("2026-11-06T22:30:00Z")), true);
  assert.equal(isWithinWorkingHours(shop, at("2026-11-07T01:00:00Z")), false); // 02:00 CET
});

test("termini u petak 23:30 prelaze ponoć i staju prije 02:00", () => {
  const slots = pickupSlots(shop, at("2026-10-02T21:30:00Z")).map(formatTime);
  assert.equal(slots[0], "23:45");
  assert.ok(slots.includes("00:00") && slots.includes("01:45"));
  assert.equal(slots.at(-1), "01:45");
});

test("termini nikad dalje od 24 h", () => {
  const from = at("2026-10-02T21:30:00Z");
  for (const slot of pickupSlots(shop, from)) {
    assert.ok(slot.getTime() <= from.getTime() + 24 * 3_600_000);
  }
});

test("redovi radnog vremena za prikaz", () => {
  assert.deepEqual(formatHoursLines(emmitoHours), ["Pon–Čet 09:00 – 23:00", "Pet–Sub 09:00 – 02:00", "Ned 16:00 – 22:00"]);
});
