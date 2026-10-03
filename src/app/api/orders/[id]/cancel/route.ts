import { after, NextResponse } from "next/server";
import { cancelDemoOrder } from "@/lib/data/order-store";
import { isPushConfigured, sendPushToRestaurant } from "@/lib/push/send";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Gost otkazuje svoju narudžbu (uuid iz linka je jedini "ključ"). Dopušteno SAMO dok je narudžba još nova:
// uvjetni UPDATE (status = 'new') znači da radnja koja je u međuvremenu potvrdila uvijek pobjeđuje.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "Narudžba nije pronađena." }, 404);

  if (cancelDemoOrder(id)) return json({ status: "cancelled" }, 200);

  let supabase;
  try {
    supabase = createServiceSupabaseClient();
  } catch {
    return json({ error: "Otkazivanje trenutno nije dostupno." }, 503);
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "new")
    .select("id, short_code, restaurant_id");
  if (error) return json({ error: "Otkazivanje nije uspjelo. Pokušaj ponovno." }, 500);

  if (!updated?.length) {
    const { data: existing } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
    if (!existing) return json({ error: "Narudžba nije pronađena." }, 404);
    if (existing.status === "cancelled") return json({ status: "cancelled" }, 200); // dvostruki klik
    return json({ error: "Radnja je već preuzela narudžbu. Za otkazivanje nazovi radnju.", status: existing.status }, 409);
  }

  const order = updated[0];
  after(async () => {
    try {
      if (!isPushConfigured()) return;
      await sendPushToRestaurant(supabase, order.restaurant_id, {
        title: "Gost je otkazao narudžbu",
        body: `${order.short_code} je otkazana. Ne pripremaj je.`,
        url: "/admin",
        tag: `cancel-${order.short_code}`,
      });
    } catch {
      console.error("[push] obavijest o otkazivanju nije poslana");
    }
  });
  return json({ status: "cancelled" }, 200);
}
