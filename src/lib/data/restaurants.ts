import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveHours, formatHoursLines, parseOpeningHours } from "@/lib/hours";
import type { PricingItem } from "@/lib/orders/pricing";
import type { RestaurantForOrder } from "@/lib/orders/prepare";
import type { MenuItemDTO, ShopDTO } from "@/lib/types";

// Dostava je samo u demo radnjama, i to uz fiksni minimalni iznos.
const DEMO_MIN_DELIVERY_EUR = 15;

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  address: string;
  logo_url: string | null;
  logo_text: string | null;
  hero_image_url: string | null;
  accent_color: string;
  phone: string | null;
  opening_hours: unknown;
  accepting_orders: boolean;
  avg_prep_minutes: number;
  prep_time_label: string | null;
  is_demo: boolean;
  ignore_hours: boolean;
};

const RESTAURANT_COLUMNS =
  "id, slug, name, description, address, logo_url, logo_text, hero_image_url, accent_color, phone, opening_hours, accepting_orders, avg_prep_minutes, prep_time_label, is_demo, ignore_hours";

function mapShop(row: RestaurantRow): ShopDTO {
  const tjedno = parseOpeningHours(row.opening_hours);
  return {
    id: row.id,
    slug: row.slug,
    naziv: row.name,
    opis: row.description,
    adresa: row.address,
    logo: row.logo_text ?? row.name.toUpperCase(),
    logoUrl: row.logo_url,
    accentColor: row.accent_color,
    telefon: row.phone,
    // Natpis ostaje pravo radno vrijeme; u testnom načinu je samo izračun otvorenosti 24/7.
    radnoVrijemeRedovi: formatHoursLines(tjedno),
    tjedno: effectiveHours(tjedno, row.ignore_hours),
    vrijemePripreme: row.prep_time_label ?? `${row.avg_prep_minutes} min`,
    heroSlika: row.hero_image_url,
    minIznosDostave: DEMO_MIN_DELIVERY_EUR,
    acceptingOrders: row.accepting_orders,
    isDemo: row.is_demo,
  };
}

export async function fetchShopBySlug(slug: string): Promise<ShopDTO | null> {
  const { data, error } = await createServerSupabaseClient()
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return mapShop(data as unknown as RestaurantRow);
}

type MenuRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  available: boolean;
  bestseller: boolean;
  sort: number;
  category: { name: string; sort: number } | null;
  option_groups: {
    id: string;
    name: string;
    type: "single" | "multi";
    required: boolean;
    max_select: number | null;
    sort: number;
    options: { id: string; name: string; price_delta_cents: number; sort: number }[];
  }[];
};

// Jedan upit za jelovnik; sortiranje radimo ovdje (kategorija, artikl, grupa, opcija).
async function fetchMenuRows(client: SupabaseClient, restaurantId: string): Promise<MenuRow[]> {
  const { data, error } = await client
    .from("menu_items")
    .select(
      "id, name, description, price_cents, image_url, available, bestseller, sort, category:categories(name, sort), option_groups(id, name, type, required, max_select, sort, options(id, name, price_delta_cents, sort))"
    )
    .eq("restaurant_id", restaurantId);
  if (error || !data) return [];

  const rows = data as unknown as MenuRow[];
  return rows
    .map((row) => ({
      ...row,
      option_groups: [...(row.option_groups ?? [])]
        .sort((a, b) => a.sort - b.sort)
        .map((group) => ({ ...group, options: [...(group.options ?? [])].sort((a, b) => a.sort - b.sort) })),
    }))
    .sort((a, b) => (a.category?.sort ?? 0) - (b.category?.sort ?? 0) || a.sort - b.sort);
}

export async function fetchMenuByShopId(restaurantId: string): Promise<MenuItemDTO[]> {
  const rows = await fetchMenuRows(createServerSupabaseClient(), restaurantId);
  return rows.map((row) => ({
    id: row.id,
    naziv: row.name,
    opis: row.description,
    cijena: row.price_cents / 100,
    kategorija: row.category?.name ?? "Ostalo",
    slika: row.image_url,
    dostupno: row.available,
    bestseller: row.bestseller,
    optionGroups: row.option_groups.map((group) => ({
      id: group.id,
      naziv: group.name,
      selectionType: group.type === "single" ? "single" : "multiple",
      obavezno: group.required,
      maxSelect: group.max_select,
      options: group.options.map((o) => ({ id: o.id, naziv: o.name, doplata: o.price_delta_cents / 100, dostupno: true })),
    })),
  }));
}

// Za izračun cijene na serveru. Sa service role klijentom vidi i nedostupne artikle, pa
// možemo reći "Artikl X više nije dostupan" umjesto "ne postoji".
export async function loadPricingItems(client: SupabaseClient, restaurantId: string): Promise<PricingItem[]> {
  const rows = await fetchMenuRows(client, restaurantId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    available: row.available,
    groups: row.option_groups.map((group) => ({
      id: group.id,
      name: group.name,
      type: group.type,
      required: group.required,
      maxSelect: group.max_select,
      options: group.options.map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.price_delta_cents })),
    })),
  }));
}

export async function loadRestaurantForOrder(client: SupabaseClient, slug: string): Promise<RestaurantForOrder | null> {
  const { data, error } = await client
    .from("restaurants")
    .select("id, slug, name, is_demo, accepting_orders, opening_hours, ignore_hours")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as Pick<RestaurantRow, "id" | "slug" | "name" | "is_demo" | "accepting_orders" | "opening_hours" | "ignore_hours">;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isDemo: row.is_demo,
    acceptingOrders: row.accepting_orders,
    tjedno: effectiveHours(parseOpeningHours(row.opening_hours), row.ignore_hours),
  };
}
