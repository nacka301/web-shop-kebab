// End-to-end provjera protiv prave baze i pokrenute aplikacije.
//   npm run dev                      (u jednom terminalu)
//   npm run test:e2e                 (u drugom; čita .env.local)
// Treba radnju 'test-radnja' (supabase/test-restaurant.sql). Ništa se ne ispisuje o ključevima.
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Nedostaju NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ili SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${ok || !detail ? "" : `  → ${detail}`}`);
  if (!ok) failed += 1;
};

const IDS = { burger: "00000000-0000-4000-8000-0000000000c1", ljuti: "00000000-0000-4000-8000-0000000000e1", sir: "00000000-0000-4000-8000-0000000000e3" };
const body = (extra = {}) => ({
  slug: "test-radnja",
  // LAŽNE cijene u zahtjevu — server ih mora ignorirati.
  items: [{ item_id: IDS.burger, qty: 2, option_ids: [IDS.ljuti, IDS.sir], price_cents: 1, unit_price_cents: 1 }],
  name: "Ivan Horvat",
  phone: "091 234 5678",
  pickup_type: "asap",
  total_cents: 1,
  src: "e2e",
  ...extra,
});
const post = (payload) =>
  fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

// 1) Očekivani iznos računamo neovisno, iz baze.
const { data: item } = await anon.from("menu_items").select("price_cents").eq("id", IDS.burger).single();
const { data: opts } = await anon.from("options").select("id, price_delta_cents").in("id", [IDS.ljuti, IDS.sir]);
const expected = (item.price_cents + opts.reduce((sum, o) => sum + o.price_delta_cents, 0)) * 2;

// 2) Narudžba s lažnom cijenom.
const response = await post(body());
const created = await response.json();
check("POST /api/orders vraća 201", response.status === 201, JSON.stringify(created));
check("odgovor ima samo order_id i short_code", Object.keys(created).sort().join() === "order_id,short_code");
check("short_code je oblika A-482", /^[A-Z]-\d{3}$/.test(created.short_code ?? ""));

const { data: row } = await service.from("orders").select("total_cents, source, customer_phone").eq("id", created.order_id).single();
check(`server je izračunao ${expected} centi, ne lažnu 1`, row?.total_cents === expected, `u bazi: ${row?.total_cents}`);
check("telefon je normaliziran na +385", row?.customer_phone === "+385912345678");
check("src je spremljen", row?.source === "e2e");

const { data: lines } = await service.from("order_items").select("name_snapshot, qty, unit_price_cents, line_total_cents").eq("order_id", created.order_id);
check("stavke imaju snapshot imena i cijene", lines?.length === 1 && lines[0].name_snapshot === "Testni burger" && lines[0].unit_price_cents === expected / 2);

// 3) RLS: anonimac ne vidi niti piše narudžbe.
const { data: anonOrders } = await anon.from("orders").select("id");
check("anonimni SELECT na orders vraća prazno", Array.isArray(anonOrders) && anonOrders.length === 0);
const { data: anonItems } = await anon.from("order_items").select("id");
check("anonimni SELECT na order_items vraća prazno", Array.isArray(anonItems) && anonItems.length === 0);
const { error: insertError } = await anon.from("orders").insert({ restaurant_id: "00000000-0000-4000-8000-0000000000a1", short_code: "X-000", customer_name: "x", customer_phone: "x", pickup_type: "asap", total_cents: 1 });
check("anonimni INSERT u orders je odbijen", !!insertError);
const { error: rpcError } = await anon.rpc("create_order", {});
check("anon ne smije zvati create_order", !!rpcError);

// 4) Praćenje: minimalna polja, bez telefona i imena.
const tracking = await (await fetch(`${BASE}/api/orders/${created.order_id}`)).json();
check("praćenje vraća status i stavke", tracking.status === "new" && tracking.items?.length === 1);
check("praćenje NE vraća ime ni telefon", !JSON.stringify(tracking).match(/Ivan|091|\+385|customer/i));

// 5) Validacije.
check("nepoznata radnja → 404", (await post(body({ slug: "ne-postoji" }))).status === 404);
check("demo radnja → 403", (await post(body({ slug: "emmito" }))).status === 403);
check("honeypot → 400", (await post(body({ website: "http://spam" }))).status === 400);
check("loš telefon → 400", (await post(body({ phone: "123" }))).status === 400);
check("prazna obavezna opcija → 400", (await post(body({ items: [{ item_id: IDS.burger, qty: 1, option_ids: [] }] }))).status === 400);

// 6) Ograničenje po IP-u (5 u 10 min). Već smo napravili 1 uspješnu; još 4 prolaze, 6. pada.
const statuses = [];
for (let i = 0; i < 5; i += 1) statuses.push((await post(body())).status);
check("6. narudžba u 10 min je blokirana (429)", statuses.at(-1) === 429, statuses.join());

// Čišćenje testnih narudžbi.
await service.from("orders").delete().eq("source", "e2e");

console.log(failed ? `\n${failed} provjera nije prošlo.` : "\nSve provjere prolaze.");
process.exit(failed ? 1 : 0);
