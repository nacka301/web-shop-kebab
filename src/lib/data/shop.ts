import { getShopData } from "@/data/shops";
import type { MenuItemDTO, ShopDTO } from "@/lib/types";

export async function fetchShopBySlug(slug: string): Promise<ShopDTO | null> {
  return getShopData(slug)?.shop ?? null;
}

export async function fetchMenuByShopId(shopId: string): Promise<MenuItemDTO[]> {
  // shopId je jednak slugu (vidi `register` u src/data/shops/index.ts).
  return getShopData(shopId)?.menu.filter((item) => item.dostupno) ?? [];
}
