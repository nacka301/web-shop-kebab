import { createHmac } from "node:crypto";
import { after, NextResponse } from "next/server";
import { loadPricingItems, loadRestaurantForOrder } from "@/lib/data/restaurants";
import { buildNewOrderEmail } from "@/lib/email/new-order";
import { sendEmail } from "@/lib/email/resend";
import { RATE_LIMIT_ORDERS, RATE_LIMIT_WINDOW_MIN } from "@/lib/orders/limits";
import { prepareOrder } from "@/lib/orders/prepare";
import { orderRequestSchema } from "@/lib/orders/schema";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const error = (status: number, message: string) => NextResponse.json({ error: message }, { status });

// IP se nikad ne sprema sirov: HMAC s tajnim ključem, samo za ograničenje broja narudžbi.
function hashIp(request: Request, secret: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "Neispravni podaci narudžbe.");
  }

  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) return error(400, "Neispravni podaci narudžbe.");
  const input = parsed.data;
  if (input.website) return error(400, "Neispravni podaci narudžbe."); // honeypot

  let supabase;
  try {
    supabase = createServiceSupabaseClient();
  } catch {
    return error(503, "Naručivanje trenutno nije dostupno.");
  }

  const restaurant = await loadRestaurantForOrder(supabase, input.slug);
  if (!restaurant) return error(404, "Radnja nije pronađena.");

  const items = await loadPricingItems(supabase, restaurant.id);
  const prepared = prepareOrder({ request: input, restaurant, items, now: new Date() });
  if (!prepared.ok) return error(prepared.status, prepared.error);
  const order = prepared.order;

  const ipHash = hashIp(request, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
  const { count, error: countError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (countError) return error(500, "Slanje narudžbe nije uspjelo. Pokušaj ponovno.");
  if ((count ?? 0) >= RATE_LIMIT_ORDERS) {
    return error(429, "Previše narudžbi u kratkom vremenu. Pokušaj ponovno za nekoliko minuta.");
  }

  const { data, error: rpcError } = await supabase.rpc("create_order", {
    p_restaurant_id: order.restaurantId,
    p_customer_name: order.customerName,
    p_customer_phone: order.customerPhone,
    p_pickup_type: order.pickupType,
    p_pickup_time: order.pickupTime ? order.pickupTime.toISOString() : null,
    p_note: order.note,
    p_source: order.source,
    p_ip_hash: ipHash,
    p_total_cents: order.totalCents,
    p_items: order.lines.map((line) => ({
      item_id: line.itemId,
      name: line.name,
      qty: line.qty,
      unit_price_cents: line.unitPriceCents,
      line_total_cents: line.lineTotalCents,
      options: line.options.map((o) => ({ group: o.group, name: o.name, price_delta_cents: o.priceDeltaCents })),
    })),
  });

  const created = Array.isArray(data) ? data[0] : data;
  if (rpcError || !created) return error(500, "Slanje narudžbe nije uspjelo. Pokušaj ponovno.");

  // Obavijest vlasniku e-mailom: NEBLOKIRAJUĆE. after() se izvršava tek kad je odgovor već otišao, a svaka
  // greška (Resend pao, loša adresa, nema postavki) se samo zabilježi — narudžba je već spremljena.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const adminUrl = `${siteUrl.replace(/\/+$/, "")}/admin`;
  after(async () => {
    try {
      const { data: owner } = await supabase.from("restaurants").select("name, owner_email").eq("id", order.restaurantId).maybeSingle();
      if (!owner?.owner_email) return;
      const email = buildNewOrderEmail({
        restaurantName: owner.name,
        shortCode: created.short_code,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        pickupType: order.pickupType,
        pickupTime: order.pickupTime,
        note: order.note,
        totalCents: order.totalCents,
        lines: order.lines,
        adminUrl,
      });
      await sendEmail({ to: owner.owner_email, ...email });
    } catch {
      console.error("[mail] obavijest o narudžbi nije poslana");
    }
  });

  return NextResponse.json({ order_id: created.order_id, short_code: created.short_code }, { status: 201 });
}
