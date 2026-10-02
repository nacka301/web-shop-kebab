import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchOrderByToken } from "@/lib/data/order";
import { fetchShopBySlug } from "@/lib/data/shop";
import OrderStatusClient from "./order-status-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  return shop ? { title: `${shop.naziv} – tvoja narudžba` } : {};
}

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ slug: string; public_token: string }>;
}) {
  const { public_token } = await params;
  const order = await fetchOrderByToken(public_token);
  if (!order) notFound();

  return <OrderStatusClient initialOrder={order} />;
}
