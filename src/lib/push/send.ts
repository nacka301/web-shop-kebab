import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPayload } from "./payload";

export type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushSender = (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, body: string) => Promise<void>;

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

// Pravi pošiljatelj preko web-push biblioteke (VAPID ključevi iz env varijabli).
export function webPushSender(): PushSender {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return async (subscription, body) => {
    await webpush.sendNotification(subscription, body, { TTL: 60 * 60, urgency: "high", timeout: 8000 });
  };
}

// Šalje obavijest svim uređajima radnje. Nikad ne baca grešku. Pretplate koje je push servis
// proglasio nevažećima (404/410) brišu se. U log ide samo broj, bez adresa uređaja.
export async function sendPushToRestaurant(
  client: SupabaseClient,
  restaurantId: string,
  payload: PushPayload,
  sender: PushSender = webPushSender()
): Promise<{ sent: number; removed: number; failed: number }> {
  const result = { sent: 0, removed: 0, failed: 0 };
  const { data, error } = await client.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("restaurant_id", restaurantId);
  if (error || !data?.length) return result;

  const body = JSON.stringify(payload);
  const gone: string[] = [];
  await Promise.all(
    (data as PushSubscriptionRow[]).map(async (row) => {
      try {
        await sender({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body);
        result.sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(row.id);
        else result.failed += 1;
      }
    })
  );
  if (gone.length > 0) {
    await client.from("push_subscriptions").delete().in("id", gone);
    result.removed = gone.length;
  }
  if (result.failed > 0) console.error("[push] neuspjelo slanje", { failed: result.failed });
  return result;
}
