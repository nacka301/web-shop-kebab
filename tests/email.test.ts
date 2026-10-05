import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { buildNewOrderEmail, escapeHtml, type NewOrderEmailInput } from "../src/lib/email/new-order";
import { isMailConfigured, sendEmail } from "../src/lib/email/resend";
import { isValidEmail } from "../src/lib/validation";

const base: NewOrderEmailInput = {
  restaurantName: "Emmito",
  shortCode: "A-482",
  customerName: "Ivan Horvat",
  customerPhone: "+385912345678",
  pickupType: "asap",
  pickupTime: null,
  note: "Bez luka",
  totalCents: 1250,
  adminUrl: "https://web-shop-kebab.vercel.app/admin",
  lines: [
    { itemId: "1", name: "Kebab veliki", qty: 2, unitPriceCents: 500, lineTotalCents: 1000, options: [{ group: "Umak", name: "Ljuti", priceDeltaCents: 0 }, { group: "Dodaci", name: "Sir", priceDeltaCents: 0 }] },
    { itemId: "2", name: "Sok", qty: 1, unitPriceCents: 250, lineTotalCents: 250, options: [] },
  ],
};

test("predmet: kod i iznos", () => {
  assert.equal(buildNewOrderEmail(base).subject, "Nova narudžba A-482 · 12,50 €");
});

test("sadržaj: kupac, telefon, vrijeme, stavke s opcijama, napomena, ukupno i gumb prema /admin", () => {
  const { html, text } = buildNewOrderEmail(base);
  for (const part of ["A-482", "Ivan Horvat", "+385912345678", "Što prije", "2×", "Kebab veliki", "Ljuti, Sir", "Sok", "Bez luka", "12,50 €"]) {
    assert.ok(html.includes(part), `html: ${part}`);
    assert.ok(text.includes(part), `text: ${part}`);
  }
  assert.ok(html.includes('href="https://web-shop-kebab.vercel.app/admin"'));
  assert.ok(html.includes("Otvori narudžbe"));
  assert.ok(text.includes("https://web-shop-kebab.vercel.app/admin"));
  assert.ok(html.includes('name="viewport"'), "prilagođeno mobitelu");
});

test("zakazano vrijeme se prikazuje po Zagrebu", () => {
  const { text } = buildNewOrderEmail({ ...base, pickupType: "time", pickupTime: new Date("2026-10-02T23:00:00Z") });
  assert.ok(text.includes("01:00 (03.10.)"), text);
});

test("XSS: ime, napomena, nazivi i opcije su escapeani u HTML-u", () => {
  const evil = `<script>alert("x")</script><img src=x onerror=alert(1)>`;
  const { html, subject } = buildNewOrderEmail({
    ...base,
    customerName: evil,
    note: evil,
    lines: [{ itemId: "1", name: evil, qty: 1, unitPriceCents: 1, lineTotalCents: 1, options: [{ group: evil, name: evil, priceDeltaCents: 0 }] }],
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(!/onerror=alert/.test(html.replace(/&lt;img src=x onerror=alert\(1\)&gt;/g, "")));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!subject.includes("<"));
});

test("novi redovi u imenu/napomeni ne mogu razbiti predmet ni zaglavlja", () => {
  const { subject, text } = buildNewOrderEmail({ ...base, shortCode: "A-1\r\nBcc: x@y.hr", note: "a\r\nb" });
  assert.ok(!/[\r\n]/.test(subject));
  assert.ok(text.includes("NAPOMENA: a b"));
});

test("escapeHtml", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("provjera oblika e-maila", () => {
  for (const ok of ["a@b.hr", "ime.prezime@primjer.com", " ankica@smash.hr "]) assert.ok(isValidEmail(ok), ok);
  for (const bad of ["", "a@b", "a b@c.hr", "@b.hr", "a@@b.hr", "x".repeat(250) + "@b.hr"]) assert.ok(!isValidEmail(bad), bad);
});

// ---- slanje: nikad ne smije srušiti narudžbu, a log ne smije imati osobne podatke ----
const realFetch = globalThis.fetch;
const realError = console.error;
let logged: unknown[][] = [];
const email = { to: "vlasnica@tajna-domena.hr", subject: "Nova narudžba A-1", html: "<p>Ivan Horvat +385912345678</p>", text: "Ivan Horvat" };

beforeEach(() => {
  logged = [];
  console.error = (...args: unknown[]) => void logged.push(args);
  process.env.RESEND_API_KEY = "re_test_key_nikad_u_logu";
  process.env.RESEND_FROM = "Narudžbe <narudzbe@primjer.hr>";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

const noPersonalData = () => {
  const dump = JSON.stringify(logged);
  for (const secret of ["vlasnica@tajna-domena.hr", "Ivan Horvat", "+385912345678", "re_test_key_nikad_u_logu"]) {
    assert.ok(!dump.includes(secret), `u logu je ${secret}`);
  }
};

test("uspješno slanje: ispravan zahtjev prema Resendu, ključ samo u zaglavlju", async () => {
  let call: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    call = { url, init };
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  assert.equal(await sendEmail(email), true);
  assert.equal(call!.url, "https://api.resend.com/emails");
  assert.equal((call!.init.headers as Record<string, string>).Authorization, "Bearer re_test_key_nikad_u_logu");
  const body = JSON.parse(call!.init.body as string);
  assert.deepEqual(body.to, ["vlasnica@tajna-domena.hr"]);
  assert.equal(body.from, "Narudžbe <narudzbe@primjer.hr>");
  assert.equal(logged.length, 0);
});

test("Resend vrati grešku: false, bez izuzetka i bez osobnih podataka u logu", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ message: "Invalid to vlasnica@tajna-domena.hr" }), { status: 422 })) as typeof fetch;
  assert.equal(await sendEmail(email), false);
  assert.equal(logged.length, 1);
  noPersonalData();
});

test("Resend pao (mrežna greška / timeout): false, bez izuzetka i bez osobnih podataka", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed za vlasnica@tajna-domena.hr");
  }) as typeof fetch;
  assert.equal(await sendEmail(email), false);
  noPersonalData();
});

test("bez RESEND_API_KEY / RESEND_FROM: ništa se ne šalje", async () => {
  delete process.env.RESEND_API_KEY;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch;
  assert.equal(isMailConfigured(), false);
  assert.equal(await sendEmail(email), false);
  assert.equal(called, false);
});
