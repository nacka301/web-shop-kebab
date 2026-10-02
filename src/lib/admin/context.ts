import { cache } from "react";
import { parseOpeningHours } from "@/lib/hours";
import { createSessionClient } from "@/lib/supabase/session";
import type { WeekHours } from "@/lib/types";

export type AdminRestaurant = {
  id: string;
  slug: string;
  name: string;
  acceptingOrders: boolean;
  tjedno: WeekHours;
};

export type StaffContext =
  | { status: "anonymous" }
  | { status: "no-access"; email: string | null }
  | { status: "ok"; email: string | null; restaurant: AdminRestaurant };

// Tko je prijavljen i koja je njegova radnja. RLS vraća samo VLASTITI redak restaurant_staff,
// pa korisnik ne može dobiti tuđu radnju čak ni kad bi pokušao.
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "anonymous" };

  const { data } = await supabase
    .from("restaurant_staff")
    .select("restaurant:restaurants(id, slug, name, accepting_orders, opening_hours)")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const row = data as unknown as {
    restaurant: { id: string; slug: string; name: string; accepting_orders: boolean; opening_hours: unknown } | null;
  } | null;
  if (!row?.restaurant) return { status: "no-access", email: auth.user.email ?? null };

  return {
    status: "ok",
    email: auth.user.email ?? null,
    restaurant: {
      id: row.restaurant.id,
      slug: row.restaurant.slug,
      name: row.restaurant.name,
      acceptingOrders: row.restaurant.accepting_orders,
      tjedno: parseOpeningHours(row.restaurant.opening_hours),
    },
  };
});
