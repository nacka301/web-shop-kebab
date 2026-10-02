import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMenuByShopId, fetchShopBySlug } from "@/lib/data/shop";
import ShopPageClient from "./shop-page-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  if (!shop) return {};
  return { title: `${shop.naziv} – naruči online`, description: shop.opis };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  if (!shop) notFound();

  const menu = await fetchMenuByShopId(shop.id);
  return <ShopPageClient shop={shop} menu={menu} />;
}
