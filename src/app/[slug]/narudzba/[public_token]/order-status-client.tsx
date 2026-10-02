"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Phone, ShoppingBag, XCircle } from "lucide-react";
import type { OrderStatusDTO } from "@/lib/types";

const OVERDUE_MS = 5 * 60 * 1000;

const money = (value: number) => `${value.toFixed(2).replace(".", ",")} €`;
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });

function statusMessage(order: OrderStatusDTO): { title: string; tone: "waiting" | "ok" | "ready" | "rejected" } {
  switch (order.status) {
    case "na_cekanju":
      return { title: "Čeka potvrdu", tone: "waiting" };
    case "prihvacena":
      return { title: order.spremnoU ? `Prihvaćeno, spremno u ${formatTime(order.spremnoU)}` : "Prihvaćeno", tone: "ok" };
    case "spremna":
      return { title: "Spremno za preuzimanje", tone: "ready" };
    case "odbijena":
      return { title: "Odbijeno", tone: "rejected" };
  }
}

export default function OrderStatusClient({ initialOrder }: { initialOrder: OrderStatusDTO }) {
  const [order] = useState(initialOrder);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const overdue = order.status === "na_cekanju" && now - new Date(order.createdAt).getTime() > OVERDUE_MS;
  const { title, tone } = statusMessage(order);

  const toneStyles: Record<string, { bg: string; icon: React.ReactNode }> = {
    waiting: { bg: "bg-amber-50 text-amber-700", icon: <Clock className="h-8 w-8" /> },
    ok: { bg: "bg-[#fff0e8] text-[var(--brand-dark)]", icon: <CheckCircle2 className="h-8 w-8" /> },
    ready: { bg: "bg-green-50 text-green-700", icon: <ShoppingBag className="h-8 w-8" /> },
    rejected: { bg: "bg-red-50 text-red-700", icon: <XCircle className="h-8 w-8" /> },
  };
  const styles = toneStyles[tone];

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[var(--background)] px-5 py-8 safe-bottom">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 card-shadow">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className={`flex h-16 w-16 items-center justify-center rounded-full ${styles.bg}`}>{styles.icon}</span>
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-sm text-[var(--muted)]">{order.shop.naziv} · narudžba za {order.imeKupca}</p>
        </div>

        {overdue && (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
            {order.shop.telefon ? <>
              Radnja još nije potvrdila — nazovite ih na{" "}
              <a href={`tel:${order.shop.telefon}`} className="inline-flex items-center gap-1 underline">
                <Phone className="h-3.5 w-3.5" /> {order.shop.telefon}
              </a>
            </> : "Radnja još nije potvrdila narudžbu."}
          </div>
        )}

        <div className="mt-5 space-y-2 rounded-2xl bg-black/[0.02] p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">Način</span>
            <strong className="text-right">{order.vrsta === "dostava" ? "Dostava" : "Preuzimanje u radnji"}</strong>
          </div>
          {order.vrsta === "dostava" && order.adresaDostave && (
            <div className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Adresa</span>
              <strong className="text-right">{order.adresaDostave}</strong>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">{order.vrsta === "dostava" ? "Dostava" : "Preuzimanje"}</span>
            <strong className="text-right">{order.odmah ? `Što prije · ${order.shop.vrijemePripreme}` : `Zakazano za ${formatTime(order.trazenoVrijeme)}`}</strong>
          </div>
          {order.napomena && (
            <div className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Napomena</span>
              <strong className="text-right">{order.napomena}</strong>
            </div>
          )}
          <div className="mt-2 space-y-0.5 border-t border-black/5 pt-2">
            {order.stavke.map((item, index) => (
              <div key={index} className="flex justify-between gap-3">
                <span>
                  {item.kolicina}× {item.nazivArtikla}
                  {item.odabraneOpcije.length > 0 && (
                    <span className="text-[var(--muted)]"> ({item.odabraneOpcije.map((o) => o.opcija).join(", ")})</span>
                  )}
                </span>
                <span className="whitespace-nowrap">{money(item.cijenaUkupno)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black">
            <span>Ukupno</span>
            <span>{money(order.ukupnaCijena)}</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          Ovo je demo — narudžba se nigdje ne šalje.
        </p>
      </div>
    </main>
  );
}
