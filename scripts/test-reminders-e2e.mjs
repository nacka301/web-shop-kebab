// End-to-end provjera podsjetnika na PRAVOJ bazi i produkciji:
//   npm run test:reminders        (čita .env.local; BASE_URL po zadanom produkcija)
// 1) ruta odbija zahtjev bez tajne, 2) pg_cron sam zove rutu za nepotvrđenu narudžbu i brojač raste,
// 3) potvrđena narudžba više ne dobiva podsjetnike. Privremenu narudžbu briše na kraju.
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "https://web-shop-kebab.vercel.app";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Nedostaju NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const A = "00000000-0000-4000-8000-0000000000a1"; // test-radnja
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${ok || !detail ? "" : `  → ${detail}`}`);
  if (!ok) failed += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let orderId = null;
try {
  const noSecret = await fetch(`${BASE}/api/cron/remind-orders`, { method: "POST" });
  check("ruta bez tajne vraća 401", noSecret.status === 401, String(noSecret.status));
  const badSecret = await fetch(`${BASE}/api/cron/remind-orders`, { method: "POST", headers: { "x-cron-secret": "pogresna" } });
  check("ruta s krivom tajnom vraća 401", badSecret.status === 401, String(badSecret.status));

  const { data, error } = await service.rpc("create_order", {
    p_restaurant_id: A, p_customer_name: "E2E Podsjetnik", p_customer_phone: "+385912345678", p_pickup_type: "asap", p_pickup_time: null,
    p_note: "e2e", p_source: "qr", p_ip_hash: "e2e", p_total_cents: 500,
    p_items: [{ item_id: null, name: "Testni burger", qty: 1, unit_price_cents: 500, line_total_cents: 500, options: [] }],
  });
  if (error) throw new Error(`create_order: ${error.message}`);
  orderId = data[0].order_id;
  // Kao da je gost naručio prije 3 minute i nitko nije potvrdio.
  await service.from("orders").update({ created_at: new Date(Date.now() - 3 * 60_000).toISOString() }).eq("id", orderId);

  let sent = 0;
  for (let i = 0; i < 24 && sent < 1; i += 1) {
    await sleep(5000);
    const { data: row } = await service.from("orders").select("reminders_sent").eq("id", orderId).single();
    sent = row?.reminders_sent ?? 0;
  }
  check("pg_cron je sam pozvao rutu i podsjetnik je zabilježen (≤ 2 min)", sent >= 1, `reminders_sent=${sent}`);

  await service.from("orders").update({ status: "accepted", eta_minutes: 10 }).eq("id", orderId);
  const { data: before } = await service.from("orders").select("reminders_sent").eq("id", orderId).single();
  await sleep(75_000);
  const { data: after } = await service.from("orders").select("reminders_sent").eq("id", orderId).single();
  check("potvrđena narudžba više ne dobiva podsjetnike", after.reminders_sent === before.reminders_sent, `${before.reminders_sent} → ${after.reminders_sent}`);
} catch (error) {
  console.error(`\nPREKID: ${error.message}`);
  failed += 1;
} finally {
  if (orderId) await service.from("orders").delete().eq("id", orderId);
}

console.log(failed ? `\n${failed} provjera nije prošlo.` : "\nSve provjere prolaze.");
process.exit(failed ? 1 : 0);
