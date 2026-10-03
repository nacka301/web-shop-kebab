import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSource, normalizeViewSource } from "../src/lib/sources";
import { buildStats, type StatsOrder } from "../src/lib/stats";
import { at } from "./fixtures";

// Petak 2026-10-02 12:00 po Zagrebu.
const NOW = at("2026-10-02T10:00:00Z");

const order = (iso: string, source: string | null, items: [string, number][], status = "accepted"): StatsOrder => ({
  createdAt: iso,
  source,
  status,
  items: items.map(([name, qty]) => ({ name, qty })),
});

test("izvor dolazi samo iz fiksnog popisa", () => {
  assert.equal(normalizeSource("QR"), "qr");
  assert.equal(normalizeSource(" ig "), "ig");
  assert.equal(normalizeSource("tiktok"), "other");
  assert.equal(normalizeSource("'; drop table orders;--"), "other");
  assert.equal(normalizeSource(""), null);
  assert.equal(normalizeSource(null), null);
  assert.equal(normalizeViewSource(undefined), "other");
  assert.equal(normalizeViewSource("fb"), "fb");
});

test("posjete, narudžbe, konverzija i razrada po izvoru", () => {
  const stats = buildStats({
    now: NOW,
    days: 7,
    views: [
      { day: "2026-10-02", src: "qr", views: 30 },
      { day: "2026-10-01", src: "ig", views: 10 },
      { day: "2026-10-01", src: "qr", views: 10 },
      { day: "2026-09-01", src: "qr", views: 999 }, // izvan raspona
    ],
    orders: [
      order("2026-10-02T09:00:00Z", "qr", [["Kebab veliki", 2]]),
      order("2026-10-01T09:00:00Z", "ig", [["Kebab veliki", 1], ["Sok", 1]]),
      order("2026-10-01T10:00:00Z", null, [["Sok", 5]], "rejected"),
      order("2026-08-01T10:00:00Z", "qr", [["Stara", 1]]), // izvan raspona
    ],
  });
  assert.equal(stats.views, 50);
  assert.equal(stats.orders, 3);
  assert.equal(stats.conversion, 6);
  const bySource = Object.fromEntries(stats.bySource.map((s) => [s.src, s]));
  assert.deepEqual([bySource.qr.views, bySource.qr.orders], [40, 1]);
  assert.deepEqual([bySource.ig.views, bySource.ig.orders], [10, 1]);
  assert.equal(bySource.other.orders, 1); // izravan dolazak (bez izvora)
});

test("top 5 artikala ne uključuje odbijene narudžbe i sortira po količini", () => {
  const stats = buildStats({
    now: NOW,
    days: 30,
    views: [],
    orders: [
      order("2026-10-02T09:00:00Z", "qr", [["A", 1], ["B", 5], ["C", 2], ["D", 3], ["E", 4], ["F", 6]]),
      order("2026-10-02T09:10:00Z", "qr", [["Odbijeno jelo", 50]], "rejected"),
    ],
  });
  assert.deepEqual(stats.topItems.map((i) => i.name), ["F", "B", "E", "D", "C"]);
  assert.equal(stats.topItems.length, 5);
});

test("narudžbe po danima: točan broj dana, dan se računa po Zagrebu (22:30Z = 00:30 sljedećeg dana)", () => {
  const stats = buildStats({
    now: NOW,
    days: 7,
    views: [],
    orders: [order("2026-10-01T22:30:00Z", "qr", [["A", 1]])], // 2026-10-02 00:30 u Zagrebu
  });
  assert.equal(stats.byDay.length, 7);
  assert.equal(stats.byDay.at(-1)?.day, "2026-10-02");
  assert.equal(stats.byDay.at(0)?.day, "2026-09-26");
  assert.equal(stats.byDay.at(-1)?.orders, 1);
  assert.equal(stats.byDay.at(-2)?.orders, 0);
});

test("malo podataka: enough = false, a konverzija je null bez posjeta", () => {
  const stats = buildStats({ now: NOW, days: 7, views: [], orders: [order("2026-10-02T09:00:00Z", "qr", [["A", 1]])] });
  assert.equal(stats.enough, false);
  assert.equal(stats.conversion, null);
  assert.equal(buildStats({ now: NOW, days: 7, views: [{ day: "2026-10-02", src: "qr", views: 10 }], orders: [] }).enough, true);
});
