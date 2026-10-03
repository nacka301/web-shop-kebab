import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isPushConfigured } from "@/lib/push/send";
import { sendDueReminders } from "@/lib/push/reminders";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function secretMatches(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Zove ga pg_cron iz Supabasea (svake minute, samo dok postoji nepotvrđena narudžba).
// Bez ispravne tajne ne radi ništa: ruta je javna na internetu, a šalje obavijesti.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Nije podešeno." }, { status: 503 });
  if (!secretMatches(request.headers.get("x-cron-secret"), secret)) return NextResponse.json({ error: "Nema pristupa." }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "Obavijesti nisu podešene." }, { status: 503 });

  const result = await sendDueReminders(createServiceSupabaseClient(), new Date());
  return NextResponse.json(result);
}
