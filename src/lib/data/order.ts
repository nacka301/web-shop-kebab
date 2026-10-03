import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { OrderStatus, OrderStatusDTO, PickupType } from "@/lib/types";
import { getOrder } from "./order-store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRow = {
  id: string;
  short_code: string;
  status: OrderStatus;
  eta_minutes: number | null;
  reject_reason: string | null;
  pickup_type: PickupType;
  pickup_time: string | null;
  total_cents: number;
  created_at: string;
  restaurant: { name: string; slug: string; phone: string | null; is_demo: boolean };
  order_items: {
    name_snapshot: string;
    qty: number;
    line_total_cents: number;
    options_snapshot: { name?: string }[] | null;
  }[];
};

// Vraća samo minimalna polja — nikad ime ni telefon kupca, jer stranicu vidi svatko tko ima uuid.
export async function fetchOrderById(id: string): Promise<OrderStatusDTO | null> {
  if (!UUID_RE.test(id)) return null;

  const demo = getOrder(id);
  if (demo) return demo;

  try {
    const { data, error } = await createServiceSupabaseClient()
      .from("orders")
      .select(
        "id, short_code, status, eta_minutes, reject_reason, pickup_type, pickup_time, total_cents, created_at, restaurant:restaurants(name, slug, phone, is_demo), order_items(name_snapshot, qty, line_total_cents, options_snapshot)"
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as unknown as OrderRow;
    return {
      id: row.id,
      shortCode: row.short_code,
      status: row.status,
      etaMinutes: row.eta_minutes,
      rejectReason: row.reject_reason,
      pickupType: row.pickup_type,
      pickupTime: row.pickup_time,
      deliveryAddress: null,
      totalCents: row.total_cents,
      items: row.order_items.map((item) => ({
        name: item.name_snapshot,
        qty: item.qty,
        lineTotalCents: item.line_total_cents,
        options: (item.options_snapshot ?? []).flatMap((o) => (o.name ? [o.name] : [])),
      })),
      restaurant: { name: row.restaurant.name, slug: row.restaurant.slug, phone: row.restaurant.phone },
      isDemo: row.restaurant.is_demo,
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}
