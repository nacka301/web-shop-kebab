// Test opterećenja i utrka na PRAVOJ bazi (preko lokalnog produkcijskog builda):
//   npx next build && npx next start -p 3100     (u jednom terminalu)
//   npm run test:load                           (u drugom; čita .env.local)
// Treba 'test-radnja' (supabase/test-restaurant.sql). Svaki "gost" ima svoju IP adresu (x-forwarded-for),
// pa ograničenje po IP-u ne pogađa test, osim u scenariju koji ga namjerno provjerava.
// Sve privremene narudžbe i korisnike briše na kraju. Lozinke su nasumične i nikad se ne ispisuju.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const GUESTS = Number(process.env.GUESTS ?? 120);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Nedostaju NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ili SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, opts);

const A = "00000000-0000-4000-8000-0000000000a1";
const BURGER = "00000000-0000-4000-8000-0000000000c1"; // 500, obavezan umak
const FRIES = "00000000-0000-4000-8000-0000000000c2"; // 250
const SAUCE = "00000000-0000-4000-8000-0000000000e1";
const CHEESE = "00000000-0000-4000-8000-0000000000e3"; // +100
const MARK = `LOAD-${Date.now()}`;

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${ok || !detail ? "" : `  → ${detail}`}`);
  if (!ok) failed += 1;
};
const pct = (arr, p) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((arr.length * p) / 100))];

async function timed(fn) {
  const t = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t };
}

const ip = (n) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
const orderBody = (name) => ({
  slug: "test-radnja",
  items: [
    { item_id: BURGER, qty: 2, option_ids: [SAUCE, CHEESE] }, // 2 × (500+100) = 1200
    { item_id: FRIES, qty: 1, option_ids: [] }, // 250
  ],
  name,
  phone: "091 234 5678",
  pickup_type: "asap",
  source: "qr",
});
const EXPECTED_TOTAL = 1450;
const postOrder = (name, fromIp) =>
  timed(() =>
    fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": fromIp }, body: JSON.stringify(orderBody(name)) }).then(
      async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })
    )
  );

const users = [];
async function makeOwner() {
  const email = `load-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  users.push(data.user.id);
  await service.from("restaurant_staff").upsert({ user_id: data.user.id, restaurant_id: A }, { onConflict: "user_id" });
  const client = createClient(url, anonKey, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`prijava: ${signInError.message}`);
  return client;
}

async function cleanup() {
  await service.from("orders").delete().like("customer_name", "LOAD-%");
  for (const id of users) await service.auth.admin.deleteUser(id);
}

try {
  await cleanup();
  const { data: prevStaff } = await service.from("restaurant_staff").select("user_id").eq("restaurant_id", A);
  if ((prevStaff ?? []).length > 0) console.log(`(napomena: radnja već ima ${prevStaff.length} vlasnika, ostaju netaknuti)`);

  // ---------- 1) Puno gostiju istovremeno ----------
  console.log(`\n--- ${GUESTS} gostiju naručuje ISTOVREMENO ---`);
  const wave = await Promise.all(Array.from({ length: GUESTS }, (_, i) => postOrder(`${MARK}-${i}`, ip(1000 + i))));
  const statuses = wave.map((w) => w.result.status);
  const created = wave.filter((w) => w.result.status === 201);
  check(`svih ${GUESTS} narudžbi prihvaćeno (201)`, created.length === GUESTS, `uspjelo ${created.length}, statusi: ${[...new Set(statuses)].join(",")}`);
  const ms = wave.map((w) => w.ms);
  console.log(`      vrijeme odgovora: p50 ${pct(ms, 50).toFixed(0)} ms, p95 ${pct(ms, 95).toFixed(0)} ms, najsporije ${Math.max(...ms).toFixed(0)} ms`);

  const ids = created.map((w) => w.result.body.order_id);
  check("svaka narudžba ima jedinstven id", new Set(ids).size === ids.length);
  const { data: rows } = await service.from("orders").select("id, short_code, total_cents, status, order_date").like("customer_name", `${MARK}-%`);
  check("u bazi je točno toliko narudžbi koliko je odgovora 201", rows?.length === created.length, `${rows?.length} u bazi`);
  check("kodovi narudžbi su jedinstveni (nema dvije iste)", new Set((rows ?? []).map((r) => `${r.order_date}|${r.short_code}`)).size === (rows ?? []).length);
  check("svaka narudžba ima točan iznos 14,50 € (server računa cijenu)", (rows ?? []).every((r) => r.total_cents === EXPECTED_TOTAL), String([...new Set((rows ?? []).map((r) => r.total_cents))]));
  const { count: itemCount } = await service.from("order_items").select("id", { count: "exact", head: true }).in("order_id", (rows ?? []).map((r) => r.id));
  check("svaka narudžba ima obje stavke (2 retka po narudžbi)", itemCount === (rows ?? []).length * 2, `${itemCount}`);

  // ---------- 2) Ista adresa: točno 5 ----------
  console.log("\n--- 25 zahtjeva s ISTE adrese odjednom (granica je 5 u 10 min) ---");
  const burst = await Promise.all(Array.from({ length: 25 }, (_, i) => postOrder(`${MARK}-same-${i}`, "10.99.99.99")));
  const ok = burst.filter((b) => b.result.status === 201).length;
  const limited = burst.filter((b) => b.result.status === 429).length;
  check("točno 5 prolazi, ostalih 20 dobiva 429", ok === 5 && limited === 20, `201: ${ok}, 429: ${limited}, ostalo: ${25 - ok - limited}`);

  // ---------- 3) Praćenje: puno otvorenih stranica ----------
  console.log("\n--- praćenje narudžbe: 300 istovremenih upita ---");
  const track = await Promise.all(Array.from({ length: 300 }, (_, i) => timed(() => fetch(`${BASE}/api/orders/${ids[i % ids.length]}`).then((r) => r.status))));
  check("svih 300 upita praćenja uspješno (200)", track.every((t) => t.result === 200), String([...new Set(track.map((t) => t.result))]));
  console.log(`      p50 ${pct(track.map((t) => t.ms), 50).toFixed(0)} ms, p95 ${pct(track.map((t) => t.ms), 95).toFixed(0)} ms`);

  // ---------- 4) Stranica radnje: puno posjetitelja ----------
  console.log("\n--- stranica radnje: 150 istovremenih posjetitelja ---");
  const pages = await Promise.all(Array.from({ length: 150 }, () => timed(() => fetch(`${BASE}/test-radnja`).then((r) => r.status))));
  check("svih 150 učitavanja stranice uspješno (200)", pages.every((p) => p.result === 200), String([...new Set(pages.map((p) => p.result))]));
  console.log(`      p50 ${pct(pages.map((p) => p.ms), 50).toFixed(0)} ms, p95 ${pct(pages.map((p) => p.ms), 95).toFixed(0)} ms`);

  // ---------- 5) Otkazivanje ----------
  console.log("\n--- otkazivanje ---");
  const cancelIds = ids.slice(0, 30);
  const cancels = await Promise.all(cancelIds.map((id) => fetch(`${BASE}/api/orders/${id}/cancel`, { method: "POST" }).then((r) => r.status)));
  check("30 gostiju istovremeno otkazuje: svi 200", cancels.every((s) => s === 200), String([...new Set(cancels)]));
  const { data: cancelledRows } = await service.from("orders").select("status").in("id", cancelIds);
  check("…i sve su 'cancelled' u bazi", (cancelledRows ?? []).every((r) => r.status === "cancelled"));

  const dupId = ids[40];
  const dup = await Promise.all(Array.from({ length: 15 }, () => fetch(`${BASE}/api/orders/${dupId}/cancel`, { method: "POST" }).then((r) => r.status)));
  check("isti gost 15 puta klikne 'otkaži': uvijek 200, bez greške", dup.every((s) => s === 200), String([...new Set(dup)]));

  const unknown = await fetch(`${BASE}/api/orders/00000000-0000-4000-8000-00000000dead/cancel`, { method: "POST" });
  check("otkazivanje nepostojeće narudžbe vraća 404", unknown.status === 404, String(unknown.status));
  const garbage = await fetch(`${BASE}/api/orders/nije-uuid/cancel`, { method: "POST" });
  check("otkazivanje s neispravnim id-em vraća 404", garbage.status === 404, String(garbage.status));

  // ---------- 6) Utrka: radnja potvrđuje, gost otkazuje ISTODOBNO ----------
  console.log("\n--- utrka: radnja potvrđuje dok gost otkazuje (40 narudžbi) ---");
  const ownerA = await makeOwner();
  const raceIds = ids.slice(50, 90);
  const outcomes = await Promise.all(
    raceIds.map(async (id) => {
      const [cancelRes, acceptRes] = await Promise.all([
        fetch(`${BASE}/api/orders/${id}/cancel`, { method: "POST" }).then((r) => r.status),
        ownerA.from("orders").update({ status: "accepted", eta_minutes: 15 }).eq("id", id).eq("status", "new").select("id").then((r) => r.data?.length ?? 0),
      ]);
      return { id, cancelRes, accepted: acceptRes === 1 };
    })
  );
  const { data: raceRows } = await service.from("orders").select("id, status").in("id", raceIds);
  const byId = new Map((raceRows ?? []).map((r) => [r.id, r.status]));
  const consistent = outcomes.every((o) => {
    const status = byId.get(o.id);
    if (o.accepted) return o.cancelRes === 409 && status === "accepted"; // radnja pobijedila: gost dobiva 409
    return o.cancelRes === 200 && status === "cancelled"; // gost pobijedio: radnja nije mogla potvrditi
  });
  const wins = outcomes.filter((o) => o.accepted).length;
  check("u svakoj utrci je TOČNO jedan pobjednik i baza se slaže s odgovorima", consistent, `radnja pobijedila ${wins}, gost ${outcomes.length - wins}`);

  // ---------- 7) Dva uređaja radnje potvrđuju istu narudžbu ----------
  console.log("\n--- dva uređaja radnje potvrđuju iste narudžbe (30) ---");
  const ownerB = await makeOwner();
  const twin = ids.slice(90, 120);
  const twinResults = await Promise.all(
    twin.map((id) =>
      Promise.all([ownerA, ownerB].map((c, k) => c.from("orders").update({ status: "accepted", eta_minutes: k === 0 ? 10 : 20 }).eq("id", id).eq("status", "new").select("id").then((r) => r.data?.length ?? 0)))
    )
  );
  check("svaku narudžbu potvrdi TOČNO jedan uređaj (nikad oba, nikad nijedan)", twinResults.every(([a, b]) => a + b === 1), JSON.stringify(twinResults.filter(([a, b]) => a + b !== 1)));

  // ---------- 8) Gost ne može otkazati ono što je radnja preuzela ----------
  const acceptedId = twin[0];
  const late = await fetch(`${BASE}/api/orders/${acceptedId}/cancel`, { method: "POST" });
  const lateBody = await late.json();
  check("potvrđenu narudžbu gost NE može otkazati (409 + uputa da nazove)", late.status === 409 && /nazovi/i.test(lateBody.error ?? ""), `${late.status} ${lateBody.error ?? ""}`);
  const { data: stillAccepted } = await service.from("orders").select("status").eq("id", acceptedId).single();
  check("…i status ostaje 'accepted'", stillAccepted.status === "accepted");

  // ---------- 9) Radnja otkazuje već potvrđenu narudžbu ----------
  const rejectOwn = await ownerA.from("orders").update({ status: "rejected", reject_reason: "Nemamo više" }).eq("id", acceptedId).eq("status", "accepted").select("id");
  check("radnja može otkazati potvrđenu narudžbu s razlogom", rejectOwn.data?.length === 1);
  const track2 = await (await fetch(`${BASE}/api/orders/${acceptedId}`)).json();
  check("gost to vidi na stranici praćenja", track2.status === "rejected" && track2.rejectReason === "Nemamo više");

  // ---------- 10) Mješoviti kontinuirani promet ----------
  console.log("\n--- 10 s kontinuiranog prometa (narudžbe + praćenje + otkazivanje) ---");
  const end = Date.now() + 10_000;
  let sentOrders = 0;
  let failedCalls = 0;
  const live = [];
  let counter = 5000;
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (Date.now() < end) {
        const n = counter++;
        const r = await postOrder(`${MARK}-live-${n}`, ip(n));
        if (r.result.status === 201) {
          sentOrders += 1;
          live.push(r.result.body.order_id);
          const t = await fetch(`${BASE}/api/orders/${r.result.body.order_id}`);
          if (t.status !== 200) failedCalls += 1;
          if (n % 3 === 0) {
            const c = await fetch(`${BASE}/api/orders/${r.result.body.order_id}/cancel`, { method: "POST" });
            if (c.status !== 200) failedCalls += 1;
          }
        } else failedCalls += 1;
      }
    })
  );
  check(`${sentOrders} narudžbi u 10 s bez ijedne greške`, failedCalls === 0 && sentOrders > 0, `neuspjelih poziva: ${failedCalls}`);
  console.log(`      ≈ ${(sentOrders / 10).toFixed(1)} narudžbi u sekundi`);
} catch (error) {
  console.error(`\nPREKID: ${error.message}`);
  failed += 1;
} finally {
  await cleanup();
}

console.log(failed ? `\n${failed} provjera nije prošlo.` : "\nSve provjere prolaze.");
process.exit(failed ? 1 : 0);
