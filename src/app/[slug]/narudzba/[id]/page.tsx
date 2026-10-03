import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchOrderById } from "@/lib/data/order";
import OrderStatusClient from "./order-status-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tvoja narudžba", robots: { index: false } };

export default async function OrderStatusPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const order = await fetchOrderById(id);
  // Uuid iz tuđe radnje na krivom slugu tretiramo kao nepostojeći.
  if (!order || order.restaurant.slug !== slug) notFound();

  return <OrderStatusClient initialOrder={order} />;
}
