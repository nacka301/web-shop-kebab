// End-to-end provjera admina protiv PRAVE baze: prijava, izolacija radnji (RLS), Realtime, brojač posjeta.
//   npm run dev        (u jednom terminalu)
//   npm run test:admin (u drugom; čita .env.local)
// Treba 'test-radnja' (supabase/test-restaurant.sql). Privremene korisnike i radnju briše na kraju.
// Lozinke su nasumične, žive samo u ovom procesu i nikad se ne ispisuju.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Nedostaju NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ili SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, opts);
const newAnon = () => createClient(url, anonKey, opts);

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${ok || !detail ? "" : `  → ${detail}`}`);
  if (!ok) failed += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const A = "00000000-0000-4000-8000-0000000000a1"; // test-radnja
const B = "00000000-0000-4000-8000-0000000000b9"; // privremena radnja B
const stamp = Date.now();
const users = [];

async function makeUser(label, restaurantId) {
  const email = `e2e-${label}-${stamp}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  users.push(data.user.id);
  await service.from("restaurant_staff").insert({ user_id: data.user.id, restaurant_id: restaurantId });
  const client = newAnon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`prijava: ${signInError.message}`);
  return client;
}

const makeOrder = async (restaurantId, name) => {
  const { data, error } = await service.rpc("create_order", {
    p_restaurant_id: restaurantId, p_customer_name: name, p_customer_phone: "+385912345678", p_pickup_type: "asap", p_pickup_time: null,
    p_note: "e2e", p_source: "qr", p_ip_hash: "e2e", p_total_cents: 500,
    p_items: [{ item_id: null, name: "Testni burger", qty: 1, unit_price_cents: 500, line_total_cents: 500, options: [] }],
  });
  if (error) throw new Error(`create_order: ${error.message}`);
  return data[0].order_id;
};

async function cleanup() {
  await service.from("orders").delete().eq("customer_name", "E2E Admin A");
  await service.from("orders").delete().eq("customer_name", "E2E Admin B");
  await service.from("restaurants").delete().eq("id", B);
  for (const id of users) await service.auth.admin.deleteUser(id);
}

try {
  await cleanup();
  await service.from("restaurants").insert({ id: B, slug: "e2e-radnja-b", name: "E2E B", owner_email: "b@example.com" });
  await service.from("restaurants").update({ owner_email: "a@example.com" }).eq("id", A);

  const ownerA = await makeUser("a", A);
  const ownerB = await makeUser("b", B);
  check("vlasnik se prijavljuje (Supabase Auth)", true);

  const orderA = await makeOrder(A, "E2E Admin A");
  const orderB = await makeOrder(B, "E2E Admin B");

  // --- izolacija radnji ---
  const seenByA = await ownerA.from("orders").select("id, customer_name");
  check("vlasnik A vidi svoju narudžbu", seenByA.data?.some((o) => o.id === orderA));
  check("vlasnik A NE vidi narudžbu radnje B", !seenByA.data?.some((o) => o.id === orderB));
  const itemsByA = await ownerA.from("order_items").select("order_id");
  check("vlasnik A čita samo stavke svojih narudžbi", itemsByA.data?.length > 0 && itemsByA.data.every((i) => i.order_id === orderA));

  const hijack = await ownerA.from("orders").update({ status: "accepted" }).eq("id", orderB).select("id");
  check("vlasnik A NE može mijenjati narudžbu radnje B", !hijack.error && hijack.data.length === 0);
  const { data: stillNew } = await service.from("orders").select("status").eq("id", orderB).single();
  check("…i status tuđe narudžbe ostaje 'new'", stillNew.status === "new");

  const price = await ownerA.from("orders").update({ total_cents: 1 }).eq("id", orderA).select("id");
  check("vlasnik NE može mijenjati iznos vlastite narudžbe", !!price.error);

  // --- Realtime: nova narudžba stiže bez osvježavanja ---
  let received = null;
  const channel = ownerA.channel("e2e-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${A}` }, (payload) => {
    received = payload;
  });
  const subscribed = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve("TIMEOUT"), 10000);
    channel.subscribe((status) => {
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
        clearTimeout(timer);
        resolve(status);
      }
    });
  });
  check("Realtime: pretplata na orders uspjela", subscribed === "SUBSCRIBED", String(subscribed));
  if (subscribed === "SUBSCRIBED") {
    // "SUBSCRIBED" stiže prije nego server stvarno aktivira praćenje promjena; treba koju sekundu.
    await sleep(4000);
    const orderLive = await makeOrder(A, "E2E Admin A");
    for (let i = 0; i < 30 && !received; i += 1) await sleep(500);
    check("Realtime: događaj o novoj narudžbi stiže unutar 15 s", received?.eventType === "INSERT" && received.new?.id === orderLive);
    await makeOrder(B, "E2E Admin B");
    await sleep(2000);
    check("Realtime: ne stižu događaji radnje B", received?.new?.restaurant_id === A);
  }
  await ownerA.removeChannel(channel);

  // --- tijek statusa ---
  const accept = await ownerA.from("orders").update({ status: "accepted", eta_minutes: 15 }).eq("id", orderA).eq("status", "new").select("id");
  check("potvrda s procjenom 15 min", accept.data?.length === 1);
  const again = await ownerA.from("orders").update({ status: "accepted", eta_minutes: 10 }).eq("id", orderA).eq("status", "new").select("id");
  check("dvostruka potvrda (već nije 'new') ne prolazi", again.data?.length === 0);
  const tracking = await (await fetch(`${BASE}/api/orders/${orderA}`)).json();
  check("gost vidi 'accepted' i ~15 min na stranici praćenja", tracking.status === "accepted" && tracking.etaMinutes === 15);

  // --- pauza ---
  const pauseOwn = await ownerA.from("restaurants").update({ accepting_orders: false }).eq("id", A).select("id");
  check("vlasnik pauzira svoju radnju", pauseOwn.data?.length === 1);
  const pauseOther = await ownerA.from("restaurants").update({ accepting_orders: false }).eq("id", B).select("id");
  check("vlasnik NE može pauzirati tuđu radnju", pauseOther.data?.length === 0);
  const blocked = await fetch(`${BASE}/api/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "test-radnja", items: [{ item_id: "00000000-0000-4000-8000-0000000000c2", qty: 1, option_ids: [] }], name: "E2E Admin A", phone: "091 234 5678", pickup_type: "asap" }),
  });
  check("pauzirana radnja: server odbija narudžbu (409)", blocked.status === 409, String(blocked.status));
  await ownerA.from("restaurants").update({ accepting_orders: true }).eq("id", A);

  // --- e-mail vlasnika je privatan ---
  const anonEmail = await newAnon().from("restaurants").select("owner_email");
  check("anonimac NE može čitati owner_email", !!anonEmail.error);
  const otherEmail = await ownerB.from("restaurants").select("owner_email").eq("id", A);
  check("vlasnik B NE može čitati owner_email radnje A", !!otherEmail.error);
  const ownEmail = await ownerA.rpc("get_owner_email", { p_restaurant_id: A });
  check("vlasnik A čita svoj e-mail kroz funkciju", ownEmail.data === "a@example.com");
  const foreignEmail = await ownerA.rpc("get_owner_email", { p_restaurant_id: B });
  check("…a tuđi dobiva null", foreignEmail.data === null);
  const badEmail = await ownerA.from("restaurants").update({ owner_email: "nije-mail" }).eq("id", A).select("id");
  check("neispravan e-mail odbija baza", !!badEmail.error);

  // --- jelovnik ---
  const price2 = await ownerA.from("menu_items").update({ price_cents: 650 }).eq("id", "00000000-0000-4000-8000-0000000000c2").select("id");
  check("vlasnik mijenja cijenu svog artikla", price2.data?.length === 1);
  await ownerA.from("menu_items").update({ price_cents: 250 }).eq("id", "00000000-0000-4000-8000-0000000000c2");

  // --- brojač posjeta ---
  const before = await service.from("page_views").select("views").eq("restaurant_id", A).eq("src", "ig");
  const total = (rows) => (rows ?? []).reduce((sum, r) => sum + r.views, 0);
  const ua = { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1" };
  const view = await fetch(`${BASE}/api/view`, { method: "POST", headers: ua, body: JSON.stringify({ slug: "test-radnja", src: "ig" }) });
  await sleep(1000);
  const after = await service.from("page_views").select("views").eq("restaurant_id", A).eq("src", "ig");
  check("posjeta s ?src=ig se zbraja", view.status === 204 && total(after.data) === total(before.data) + 1);
  await fetch(`${BASE}/api/view`, { method: "POST", headers: { ...ua, "User-Agent": "Googlebot/2.1" }, body: JSON.stringify({ slug: "test-radnja", src: "ig" }) });
  await fetch(`${BASE}/api/view`, { method: "POST", headers: ua, body: JSON.stringify({ slug: "emmito", src: "ig" }) });
  await sleep(1000);
  const afterBot = await service.from("page_views").select("views").eq("restaurant_id", A).eq("src", "ig");
  check("robot se ne broji", total(afterBot.data) === total(after.data));
  const demoViews = await service.from("page_views").select("views").eq("restaurant_id", (await service.from("restaurants").select("id").eq("slug", "emmito").single()).data.id);
  check("demo radnja se ne broji", (demoViews.data ?? []).length === 0);
  const ownViews = await ownerA.from("page_views").select("restaurant_id");
  check("vlasnik A čita samo posjete svoje radnje", (ownViews.data ?? []).every((r) => r.restaurant_id === A));
  const anonViews = await newAnon().from("page_views").select("views");
  check("anonimac NE čita page_views", !!anonViews.error || (anonViews.data ?? []).length === 0);
} catch (error) {
  console.error(`\nPREKID: ${error.message}`);
  failed += 1;
} finally {
  await cleanup();
  await service.from("restaurants").update({ owner_email: null, accepting_orders: true }).eq("id", A);
}

console.log(failed ? `\n${failed} provjera nije prošlo.` : "\nSve provjere prolaze.");
process.exit(failed ? 1 : 0);
