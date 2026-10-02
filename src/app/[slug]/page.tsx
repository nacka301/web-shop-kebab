import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { fetchMenuByShopId, fetchShopBySlug } from "@/lib/data/restaurants";
import ShopPageClient from "./shop-page-client";
import ViewBeacon from "./view-beacon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  if (!shop) return {};

  const ogTitle = `${shop.naziv} · Naruči online`;
  const description = shop.opis || `Naruči iz ${shop.naziv} bez čekanja u redu.`;
  return {
    title: `${shop.naziv} – naruči online`,
    description,
    // Pregled linka u WhatsAppu/Instagramu; slika je generirana kartica (opengraph-image.tsx).
    openGraph: { title: ogTitle, description, type: "website", locale: "hr_HR", siteName: shop.naziv, url: `/${shop.slug}` },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  return { themeColor: shop?.accentColor ?? "#e8491d" };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  if (!shop) notFound();

  const menu = await fetchMenuByShopId(shop.id);
  return (
    <>
      <ShopPageClient shop={shop} menu={menu} />
      <ViewBeacon slug={shop.slug} />
    </>
  );
}
