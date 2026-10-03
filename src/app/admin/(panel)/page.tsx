import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import { fetchAdminOrders } from "@/lib/admin/orders";
import { zagrebDayStart } from "@/lib/hours";
import { createSessionClient } from "@/lib/supabase/session";
import OrdersBoard from "./orders-board";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/admin/login");

  const supabase = await createSessionClient();
  const orders = await fetchAdminOrders(supabase, context.restaurant.id, zagrebDayStart(new Date())).catch(() => []);
  return <OrdersBoard restaurant={context.restaurant} initialOrders={orders} />;
}
