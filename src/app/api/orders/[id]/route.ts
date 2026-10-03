import { NextResponse } from "next/server";
import { fetchOrderById } from "@/lib/data/order";

export const dynamic = "force-dynamic";

// Polling stranice praćenja. Vraća samo minimalna polja (vidi fetchOrderById).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await fetchOrderById(id);
  if (!order) return NextResponse.json({ error: "Narudžba nije pronađena." }, { status: 404 });
  return NextResponse.json(order, { headers: { "Cache-Control": "no-store" } });
}
