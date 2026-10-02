import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminCategory = { id: string; name: string; sort: number };
export type AdminMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  sort: number;
};
export type AdminMenu = { categories: AdminCategory[]; items: AdminMenuItem[] };

// Vlasnik vidi SVE artikle svoje radnje, i nedostupne (RLS). Gosti vide samo dostupne.
export async function fetchAdminMenu(client: SupabaseClient, restaurantId: string): Promise<AdminMenu> {
  const [categories, items] = await Promise.all([
    client.from("categories").select("id, name, sort").eq("restaurant_id", restaurantId).order("sort"),
    client
      .from("menu_items")
      .select("id, category_id, name, description, price_cents, available, sort")
      .eq("restaurant_id", restaurantId)
      .order("sort"),
  ]);
  if (categories.error) throw categories.error;
  if (items.error) throw items.error;

  return {
    categories: categories.data as AdminCategory[],
    items: (items.data as { id: string; category_id: string; name: string; description: string; price_cents: number; available: boolean; sort: number }[]).map(
      (row) => ({
        id: row.id,
        categoryId: row.category_id,
        name: row.name,
        description: row.description,
        priceCents: row.price_cents,
        available: row.available,
        sort: row.sort,
      })
    ),
  };
}

// "5,50" ili "5.5" -> 550 centi; null ako nije valjana cijena (0 do 300 €).
export function parseEuroToCents(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 300) return null;
  return Math.round(value * 100);
}
