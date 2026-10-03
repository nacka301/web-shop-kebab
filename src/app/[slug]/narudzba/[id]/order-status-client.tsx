"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Phone, ShoppingBag, XCircle } from "lucide-react";
import { formatTime } from "@/lib/hours";
import type { OrderStatusDTO } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;
const OVERDUE_MS = 5 * 60 * 1000;
const TERMINAL: OrderStatusDTO["status"][] = ["done", "rejected", "cancelled"];

const money = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

type Tone = "waiting" | "ok" | "ready" | "rejected";

function statusMessage(order: OrderStatusDTO): { title: string; tone: Tone } {
  switch (order.status) {
    case "new":
      return { title: "Zaprimljeno", tone: "waiting" };
    case "accepted":
      return {
        title: order.etaMinutes ? `Potvrđeno (spremno za ~${order.etaMinutes} min)` : "Potvrđeno",
        tone: "ok",
      };
    case "ready":
      return { title: "Spremno za preuzimanje", tone: "ready" };
    case "done":
      return { title: "Preuzeto", tone: "ready" };
    case "rejected":
      return { title: "Odbijeno", tone: "rejected" };
    case "cancelled":
      return { title: "Narudžba je otkazana", tone: "rejected" };
  }
}

export default function OrderStatusClient({ initialOrder }: { initialOrder: OrderStatusDTO }) {
  const [order, setOrder] = useState(initialOrder);
  const [now, setNow] = useState(() => Date.now());
  const polling = !order.isDemo && !TERMINAL.includes(order.status);

  // Za kasnije otvaranje stranice (npr. nakon zatvaranja taba).
  useEffect(() => {
    try {
      window.localStorage.setItem(`lastOrder:${initialOrder.restaurant.slug}`, JSON.stringify({ id: initialOrder.id, at: Date.now() }));
    } catch {
      // localStorage može biti blokiran (privatni prozor) — stranica radi i bez njega.
    }
  }, [initialOrder.id, initialOrder.restaurant.slug]);

  useEffect(() => {
    if (!polling) return;
    const poll = async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (response.ok) setOrder((await response.json()) as OrderStatusDTO);
      } catch {
        // Mrežna greška: probamo opet kod sljedećeg ticka.
      }
    };
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [order.id, polling]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/cancel`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) setOrder({ ...order, status: "cancelled" });
      else {
        setCancelError(body.error ?? "Otkazivanje nije uspjelo. Pokušaj ponovno.");
        // radnja je u međuvremenu preuzela narudžbu: prikaži pravi status
        const fresh = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (fresh.ok) setOrder((await fresh.json()) as OrderStatusDTO);
      }
    } catch {
      setCancelError("Nema veze. Pokušaj ponovno.");
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  const overdue = order.status === "new" && now - new Date(order.createdAt).getTime() > OVERDUE_MS;
  const { title, tone } = statusMessage(order);

  const toneStyles: Record<Tone, { bg: string; icon: React.ReactNode }> = {
    waiting: { bg: "bg-amber-50 text-amber-700", icon: <Clock className="h-8 w-8" /> },
    ok: { bg: "bg-[#fff0e8] text-[var(--brand-dark)]", icon: <CheckCircle2 className="h-8 w-8" /> },
    ready: { bg: "bg-green-50 text-green-700", icon: <ShoppingBag className="h-8 w-8" /> },
    rejected: { bg: "bg-red-50 text-red-700", icon: <XCircle className="h-8 w-8" /> },
  };
  const styles = toneStyles[tone];
  const isDelivery = order.deliveryAddress !== null;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[var(--background)] px-5 py-8 safe-bottom">
      {order.isDemo && (
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Demo — narudžba se nigdje ne šalje</p>
      )}
      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 card-shadow">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className={`flex h-16 w-16 items-center justify-center rounded-full ${styles.bg}`}>{styles.icon}</span>
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-sm text-[var(--muted)]">
            {order.restaurant.name} · broj narudžbe <strong className="text-[var(--foreground)]">{order.shortCode}</strong>
          </p>
          {order.status === "rejected" && order.rejectReason && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{order.rejectReason}</p>
          )}
        </div>

        {overdue && (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
            {order.restaurant.phone ? (
              <>
                Radnja još nije potvrdila — nazovite ih na{" "}
                <a href={`tel:${order.restaurant.phone}`} className="inline-flex items-center gap-1 underline">
                  <Phone className="h-3.5 w-3.5" /> {order.restaurant.phone}
                </a>
              </>
            ) : (
              "Radnja još nije potvrdila narudžbu."
            )}
          </div>
        )}

        <div className="mt-5 space-y-2 rounded-2xl bg-black/[0.02] p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">Način</span>
            <strong className="text-right">{isDelivery ? "Dostava" : "Preuzimanje u radnji"}</strong>
          </div>
          {isDelivery && (
            <div className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Adresa</span>
              <strong className="text-right">{order.deliveryAddress}</strong>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">{isDelivery ? "Dostava" : "Preuzimanje"}</span>
            <strong className="text-right">
              {order.pickupType === "time" && order.pickupTime
                ? `Zakazano za ${formatTime(new Date(order.pickupTime))}`
                : "Što prije"}
            </strong>
          </div>
          <div className="mt-2 space-y-0.5 border-t border-black/5 pt-2">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between gap-3">
                <span>
                  {item.qty}× {item.name}
                  {item.options.length > 0 && <span className="text-[var(--muted)]"> ({item.options.join(", ")})</span>}
                </span>
                <span className="whitespace-nowrap">{money(item.lineTotalCents)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black">
            <span>Ukupno</span>
            <span>{money(order.totalCents)}</span>
          </div>
        </div>

        {order.status === "new" && (
          <div className="mt-5">
            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                className="min-h-12 w-full rounded-xl border border-red-200 px-4 text-base font-bold text-red-700 transition active:scale-[0.98]"
              >
                Otkaži narudžbu
              </button>
            ) : (
              <div className="rounded-2xl bg-red-50 p-3">
                <p className="text-center text-base font-bold text-red-800">Sigurno želiš otkazati narudžbu {order.shortCode}?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setConfirmCancel(false)} disabled={cancelling} className="min-h-12 rounded-xl bg-white px-3 text-base font-bold disabled:opacity-50">
                    Ne, zadrži
                  </button>
                  <button onClick={() => void cancel()} disabled={cancelling} className="min-h-12 rounded-xl bg-red-600 px-3 text-base font-bold text-white disabled:opacity-50">
                    {cancelling ? "Otkazivanje…" : "Da, otkaži"}
                  </button>
                </div>
              </div>
            )}
            {cancelError && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-base font-semibold text-red-700">{cancelError}</p>}
          </div>
        )}

        {(order.status === "accepted" || order.status === "ready") && order.restaurant.phone && !order.isDemo && (
          <p className="mt-4 text-center text-base text-[var(--muted)]">
            Treba promjena ili otkazivanje? Nazovi radnju:{" "}
            <a href={`tel:${order.restaurant.phone}`} className="inline-flex items-center gap-1 font-bold text-[var(--foreground)] underline">
              <Phone className="h-4 w-4" /> {order.restaurant.phone}
            </a>
          </p>
        )}

        {polling && (
          <p className="mt-4 text-center text-xs text-[var(--muted)]">
            Ova stranica se automatski osvježava — nema potrebe za ručnim refreshanjem.
          </p>
        )}
      </div>
    </main>
  );
}
