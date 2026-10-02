import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import { getSiteUrl } from "@/lib/site-url";
import QrPanel from "./qr-panel";

export const dynamic = "force-dynamic";

export default async function AdminQrPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/admin/login");
  const site = await getSiteUrl();

  return <QrPanel slug={context.restaurant.slug} name={context.restaurant.name} siteUrl={site.url} siteUrlConfigured={site.configured} />;
}
