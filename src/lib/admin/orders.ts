import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus, PickupType } from "@/lib/types";

export type AdminOrder = {
  id: string;
  shortCode: string;
  customerName: string;
  customerPhone: string;
  pickupType: PickupType;
  pickupTime: string | null;
  note: string;
  status: OrderStatus;
  etaMinutes: number | null;
  rejectReason: string | null;
  totalCents: number;
  createdAt: string;
  items: { id: string; name: string; qty: number; lineTotalCents: number; options: string[] }[];
};

const ORDER_SELECT =
  "id, short_code, customer_name, customer_phone, pickup_type, pickup_time, note, status, eta_minutes, reject_reason, total_cents, created_at, order_items(id, name_snapshot, qty, line_total_cents, options_snapshot)";

type Row = {
  id: string;
  short_code: string;
  customer_name: string;
  customer_phone: string;
  pickup_type: PickupType;
  pickup_time: string | null;
  note: string;
  status: OrderStatus;
  eta_minutes: number | null;
  reject_reason: string | null;
  total_cents: number;
  created_at: string;
  order_items: { id: string; name_snapshot: string; qty: number; line_total_cents: number; options_snapshot: { name?: string }[] | null }[];
};

// Sve aktivne narudžbe (nove, u pripremi, spremne) + sve od `since` (za dnevni sažetak).
// Radi s anon klijentom i sesijom vlasnika: RLS vraća samo narudžbe njegove radnje.
export async function fetchAdminOrders(client: SupabaseClient, restaurantId: string, since: Date): Promise<AdminOrder[]> {
  const { data, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .eq("restaurant_id", restaurantId)
    .or(`status.in.(new,accepted,ready),created_at.gte.${since.toISOString()}`)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    shortCode: row.short_code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    pickupType: row.pickup_type,
    pickupTime: row.pickup_time,
    note: row.note,
    status: row.status,
    etaMinutes: row.eta_minutes,
    rejectReason: row.reject_reason,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    items: row.order_items.map((item) => ({
      id: item.id,
      name: item.name_snapshot,
      qty: item.qty,
      lineTotalCents: item.line_total_cents,
      options: (item.options_snapshot ?? []).flatMap((o) => (o.name ? [o.name] : [])),
    })),
  }));
}

export const formatEuro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
