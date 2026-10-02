import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import { isMailConfigured } from "@/lib/email/resend";
import { createSessionClient } from "@/lib/supabase/session";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/admin/login");

  // E-mail se ne čita izravno iz tablice (nije javan): samo vlasnik radnje ga dobiva kroz funkciju.
  const supabase = await createSessionClient();
  const { data } = await supabase.rpc("get_owner_email", { p_restaurant_id: context.restaurant.id });

  return <SettingsForm restaurantId={context.restaurant.id} initialEmail={typeof data === "string" ? data : ""} mailConfigured={isMailConfigured()} />;
}
