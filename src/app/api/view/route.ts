import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeViewSource } from "@/lib/sources";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

// Osnovna provjera robota. User-agent se samo čita za ovu odluku, nikad se ne sprema.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|axios|node-fetch|monitor|lighthouse|pingdom|uptime/i;

const bodySchema = z.object({ slug: z.string().min(1).max(80), src: z.string().max(40).nullish() });

// Svi odgovori su 204: ruta ne otkriva je li posjet zbrojen.
const ignored = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  if (BOT_PATTERN.test(request.headers.get("user-agent") ?? "")) return ignored();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return ignored();

  // Prijavljeni vlasnik/admin ne broji se (provjera tek ako uopće postoji Supabase kolačić).
  const hasSession = (request.headers.get("cookie") ?? "").includes("sb-");
  if (hasSession) {
    try {
      const { data } = await (await createSessionClient()).auth.getUser();
      if (data.user) return ignored();
    } catch {
      // Ako se sesija ne može provjeriti, posjet se jednostavno broji kao gost.
    }
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { data: restaurant } = await supabase.from("restaurants").select("id, is_demo").eq("slug", parsed.data.slug).maybeSingle();
    if (!restaurant || restaurant.is_demo) return ignored();

    await supabase.rpc("increment_page_view", { p_restaurant_id: restaurant.id, p_src: normalizeViewSource(parsed.data.src) });
  } catch {
    // Brojanje nikad ne smije smetati gostu.
  }
  return ignored();
}
