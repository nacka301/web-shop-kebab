import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/admin/context";
import { buildNewOrderPush } from "@/lib/push/payload";
import { isPushConfigured, sendPushToRestaurant } from "@/lib/push/send";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Probna obavijest vlasniku: samo prijavljeni vlasnik, samo uređajima SVOJE radnje.
export async function POST() {
  const context = await getStaffContext();
  if (context.status !== "ok") return NextResponse.json({ error: "Nema pristupa." }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "Obavijesti nisu podešene na serveru." }, { status: 503 });

  const payload = { ...buildNewOrderPush({ shortCode: "TEST", itemCount: 1, totalCents: 500 }), title: "Probna obavijest", body: "Ovako izgleda nova narudžba." };
  const result = await sendPushToRestaurant(createServiceSupabaseClient(), context.restaurant.id, payload);
  return NextResponse.json(result, { status: result.sent > 0 ? 200 : 502 });
}
