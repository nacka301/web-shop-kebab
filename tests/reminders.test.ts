import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildReminderPush, isDueForReminder, type ReminderCandidate } from "../src/lib/push/reminders";

const NOW = new Date("2026-10-03T20:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();
const order = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  id: "o1",
  restaurantId: "r1",
  shortCode: "M-214",
  createdAt: ago(120),
  remindersSent: 0,
  lastRemindedAt: null,
  ...over,
});

describe("kad je podsjetnik dospio", () => {
  test("ne prije 90 s od narudžbe", () => {
    assert.equal(isDueForReminder(order({ createdAt: ago(60) }), NOW), false);
    assert.equal(isDueForReminder(order({ createdAt: ago(95) }), NOW), true);
  });
  test("zatim najranije svakih ~2 min", () => {
    assert.equal(isDueForReminder(order({ createdAt: ago(300), remindersSent: 1, lastRemindedAt: ago(60) }), NOW), false);
    assert.equal(isDueForReminder(order({ createdAt: ago(300), remindersSent: 1, lastRemindedAt: ago(115) }), NOW), true);
  });
  test("najviše 3 podsjetnika", () => {
    assert.equal(isDueForReminder(order({ createdAt: ago(900), remindersSent: 3, lastRemindedAt: ago(500) }), NOW), false);
  });
  test("narudžbe starije od 30 min više ne bude nikoga", () => {
    assert.equal(isDueForReminder(order({ createdAt: ago(31 * 60) }), NOW), false);
  });
});

describe("tekst podsjetnika", () => {
  test("jedna narudžba", () => {
    const p = buildReminderPush([{ shortCode: "M-214", createdAt: ago(150) }], NOW);
    assert.equal(p.title, "Narudžba čeka potvrdu!");
    assert.match(p.body, /^M-214 čeka već 3 min/);
    assert.equal(p.url, "/admin");
  });
  test("više narudžbi u jednoj obavijesti", () => {
    const p = buildReminderPush(
      [
        { shortCode: "M-1", createdAt: ago(120) },
        { shortCode: "M-2", createdAt: ago(300) },
      ],
      NOW
    );
    assert.match(p.body, /^2 narudžbe čekaju potvrdu \(M-1, M-2\)\. Najstarija 5 min\./);
  });
  test("obavijest ne sadrži ime ni telefon gosta", () => {
    const p = buildReminderPush([{ shortCode: "M-1", createdAt: ago(120) }], NOW);
    assert.equal(JSON.stringify(p).includes("+385"), false);
  });
});
