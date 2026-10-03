"use server";

import { loadPricingItems, loadRestaurantForOrder } from "@/lib/data/restaurants";
import { saveOrder } from "@/lib/data/order-store";
import { prepareOrder } from "@/lib/orders/prepare";
import { orderRequestSchema } from "@/lib/orders/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DemoOrderInput, SubmitOrderResult } from "@/lib/types";

const DEMO_MIN_DELIVERY_CENTS = 15 * 100;

// Lažna potvrda za DEMO radnje: iste provjere i isti izračun cijene kao prava narudžba,
// ali se ništa ne sprema u bazu. Stvarne radnje naručuju preko POST /api/orders.
export async function submitDemoOrder(input: DemoOrderInput): Promise<SubmitOrderResult> {
  const parsed = orderRequestSchema.safeParse({
    slug: input.slug,
    items: input.cart.map((line) => ({ item_id: line.itemId, qty: line.quantity, option_ids: line.optionIds })),
    name: input.ime,
    phone: input.telefon,
    pickup_type: input.odmah ? "asap" : "time",
    pickup_time: input.odmah ? null : input.scheduledTime,
    note: input.napomena,
  });
  if (!parsed.success) return { ok: false, error: "Neispravni podaci narudžbe." };
  if (input.vrsta === "dostava" && !input.adresaDostave?.trim()) {
    return { ok: false, error: "Unesi adresu dostave." };
  }

  const supabase = createServerSupabaseClient();
  const restaurant = await loadRestaurantForOrder(supabase, input.slug);
  if (!restaurant) return { ok: false, error: "Radnja nije pronađena." };
  if (!restaurant.isDemo) return { ok: false, error: "Ova radnja prima prave narudžbe." };

  const items = await loadPricingItems(supabase, restaurant.id);
  const prepared = prepareOrder({ request: parsed.data, restaurant, items, now: new Date(), allowDemo: true });
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const order = prepared.order;

  if (input.vrsta === "dostava" && order.totalCents < DEMO_MIN_DELIVERY_CENTS) {
    return {
      ok: false,
      error: `Minimalni iznos za dostavu je ${(DEMO_MIN_DELIVERY_CENTS / 100).toFixed(2).replace(".", ",")} €.`,
    };
  }

  const orderId = crypto.randomUUID();
  saveOrder(orderId, {
    id: orderId,
    shortCode: `D-${100 + Math.floor(Math.random() * 900)}`,
    status: "new",
    etaMinutes: null,
    rejectReason: null,
    pickupType: order.pickupType,
    pickupTime: order.pickupTime ? order.pickupTime.toISOString() : null,
    deliveryAddress: input.vrsta === "dostava" ? (input.adresaDostave?.trim() ?? null) : null,
    totalCents: order.totalCents,
    items: order.lines.map((line) => ({
      name: line.name,
      qty: line.qty,
      lineTotalCents: line.lineTotalCents,
      options: line.options.map((o) => o.name),
    })),
    restaurant: { name: restaurant.name, slug: restaurant.slug, phone: null },
    isDemo: true,
    createdAt: new Date().toISOString(),
  });

  return { ok: true, orderId };
}
