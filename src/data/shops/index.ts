import type { MenuItemDTO, ShopDTO } from "@/lib/types";
import * as grillBox from "./grill-box";
import * as emmito from "./emmito";

export type ShopData = { shop: ShopDTO; menu: MenuItemDTO[] };

// Ruta /[slug] traži radnju ovdje. /grill-box i /smash dijele isti skup podataka jer su
// obje rute i dosad prikazivale isti demo. `id` je uvijek jednak slugu, pa server action
// može iz poslanog shopId-a pronaći istu radnju.
function register(slug: string, data: ShopData): [string, ShopData] {
  return [slug, { shop: { ...data.shop, id: slug, slug }, menu: data.menu }];
}

const bySlug: Record<string, ShopData> = Object.fromEntries([
  register("grill-box", grillBox),
  register("smash", grillBox),
  register("emmito", emmito),
]);

export function getShopData(slug: string): ShopData | null {
  return bySlug[slug] ?? null;
}

export const shopSlugs = Object.keys(bySlug);
