import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPayload } from "./payload";
import { sendPushToRestaurant, type PushSender } from "./send";

// Prvi podsjetnik nakon 90 s bez potvrde, zatim svake ~2 min, najviše 3 puta, i to samo
// za narudžbe mlađe od 30 min (stare nepotvrđene više nikoga ne bude usred noći).
export const FIRST_REMINDER_AFTER_S = 90;
export const REMINDER_EVERY_S = 110;
export const MAX_REMINDERS = 3;
export const MAX_AGE_MIN = 30;

export type ReminderCandidate = {
  id: string;
  restaurantId: string;
  shortCode: string;
  createdAt: string;
  remindersSent: number;
  lastRemindedAt: string | null;
};

export function isDueForReminder(order: ReminderCandidate, now: Date): boolean {
  const ageS = (now.getTime() - new Date(order.createdAt).getTime()) / 1000;
  if (order.remindersSent >= MAX_REMINDERS) return false;
  if (ageS < FIRST_REMINDER_AFTER_S || ageS > MAX_AGE_MIN * 60) return false;
  if (!order.lastRemindedAt) return true;
  return (now.getTime() - new Date(order.lastRemindedAt).getTime()) / 1000 >= REMINDER_EVERY_S;
}

const plural = (n: number) => {
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return "narudžba čeka";
  return "narudžbe čekaju";
};

// Jedna obavijest po radnji, bez obzira na broj nepotvrđenih narudžbi.
export function buildReminderPush(orders: { shortCode: string; createdAt: string }[], now: Date): PushPayload {
  const oldestMin = Math.max(1, Math.round(Math.max(...orders.map((o) => now.getTime() - new Date(o.createdAt).getTime())) / 60_000));
  const codes = orders.map((o) => o.shortCode).join(", ");
  return {
    title: "Narudžba čeka potvrdu!",
    body: orders.length === 1 ? `${codes} čeka već ${oldestMin} min. Potvrdi ili odbij.` : `${orders.length} ${plural(orders.length)} potvrdu (${codes}). Najstarija ${oldestMin} min.`,
    url: "/admin",
    tag: "waiting-orders",
  };
}

type OrderRow = {
  id: string;
  restaurant_id: string;
  short_code: string;
  created_at: string;
  reminders_sent: number;
  last_reminded_at: string | null;
};

// Poziva ga zakazani posao (pg_cron) svake minute. Za svaku dospjelu narudžbu prvo "zauzme" podsjetnik
// uvjetnim UPDATE-om (brojač mora biti nepromijenjen), pa dva istovremena poziva ne pošalju dvostruko.
export async function sendDueReminders(client: SupabaseClient, now: Date, sender?: PushSender): Promise<{ due: number; claimed: number; restaurants: number }> {
  const oldest = new Date(now.getTime() - MAX_AGE_MIN * 60_000).toISOString();
  const { data, error } = await client
    .from("orders")
    .select("id, restaurant_id, short_code, created_at, reminders_sent, last_reminded_at")
    .eq("status", "new")
    .gte("created_at", oldest)
    .lt("reminders_sent", MAX_REMINDERS);
  if (error || !data) return { due: 0, claimed: 0, restaurants: 0 };

  const due = (data as OrderRow[]).filter((row) =>
    isDueForReminder(
      { id: row.id, restaurantId: row.restaurant_id, shortCode: row.short_code, createdAt: row.created_at, remindersSent: row.reminders_sent, lastRemindedAt: row.last_reminded_at },
      now
    )
  );

  const claimed: OrderRow[] = [];
  for (const row of due) {
    const { data: updated } = await client
      .from("orders")
      .update({ reminders_sent: row.reminders_sent + 1, last_reminded_at: now.toISOString() })
      .eq("id", row.id)
      .eq("status", "new")
      .eq("reminders_sent", row.reminders_sent)
      .select("id");
    if (updated?.length) claimed.push(row);
  }

  const byRestaurant = new Map<string, OrderRow[]>();
  for (const row of claimed) byRestaurant.set(row.restaurant_id, [...(byRestaurant.get(row.restaurant_id) ?? []), row]);
  for (const [restaurantId, rows] of byRestaurant) {
    await sendPushToRestaurant(client, restaurantId, buildReminderPush(rows.map((r) => ({ shortCode: r.short_code, createdAt: r.created_at })), now), sender);
  }
  return { due: due.length, claimed: claimed.length, restaurants: byRestaurant.size };
}
