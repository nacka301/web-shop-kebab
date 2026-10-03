import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import { createSessionClient } from "@/lib/supabase/session";
import MenuManager from "./menu-manager";
import { fetchAdminMenu } from "./menu-data";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/admin/login");

  const supabase = await createSessionClient();
  const menu = await fetchAdminMenu(supabase, context.restaurant.id).catch(() => ({ categories: [], items: [] }));
  return <MenuManager restaurant={context.restaurant} initial={menu} />;
}
