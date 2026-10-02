"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellOff, Check, Clock, Phone, Volume2, Wifi, WifiOff, X } from "lucide-react";
import { fetchAdminOrders, formatEuro, type AdminOrder } from "@/lib/admin/orders";
import type { AdminRestaurant } from "@/lib/admin/context";
import { formatTime, openStatusLabel, zagrebDayStart } from "@/lib/hours";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { OrderStatus } from "@/lib/types";
import { readFlag, useChime, useTitleBlink, useWakeLock, writeFlag } from "./alerts";

type Tab = "new" | "accepted" | "ready";

const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "Nove" },
  { key: "accepted", label: "U pripremi" },
  { key: "ready", label: "Spremne" },
];
const ETA_CHOICES = [10, 15, 20, 30];
const REJECT_REASONS = ["Nemamo više", "Prezauzeti smo", "Zatvoreno"];
const POLL_MS = 10_000;
const SAFETY_POLL_MS = 60_000;
const CONNECTED_GRACE_MS = 25_000;
const REPEAT_SOUND_MS = 20_000;
const WAKE_HINT_KEY = "adminWakeHintSeen";
const INSTALL_HINT_KEY = "adminInstallHintSeen";

// 1 narudžba, 2–4 narudžbe, 5+ narudžbi (i 11–14 narudžbi).
const ordersLabel = (n: number) => {
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return "narudžba";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "narudžbe";
  return "narudžbi";
};

const btn =
  "min-h-12 rounded-xl px-4 text-base font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

export default function OrdersBoard({ restaurant, initialOrders }: { restaurant: AdminRestaurant; initialOrders: AdminOrder[] }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [orders, setOrders] = useState(initialOrders);
  const [accepting, setAccepting] = useState(restaurant.acceptingOrders);
  const [tab, setTab] = useState<Tab>("new");
  const [now, setNow] = useState(0);
  const [hoursLabel, setHoursLabel] = useState("");
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [lastPollOk, setLastPollOk] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWakeHint, setShowWakeHint] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const realtimeRef = useRef(false);
  const lastRefreshRef = useRef(0);

  const chime = useChime();
  const wake = useWakeLock();

  const refresh = useCallback(async () => {
    try {
      const list = await fetchAdminOrders(supabase, restaurant.id, zagrebDayStart(new Date()));
      setOrders(list);
      lastRefreshRef.current = Date.now();
      setLastPollOk(Date.now());
    } catch {
      // Neuspjeli poll ne mijenja lastPollOk, pa traka postaje crvena nakon CONNECTED_GRACE_MS.
    }
  }, [supabase, restaurant.id]);

  // Uživo: Realtime na orders ove radnje. Svaka promjena osvježi popis (stavke dolaze uz narudžbu).
  useEffect(() => {
    const channel = supabase
      .channel(`orders:${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => {
        void refresh();
      })
      .subscribe((status) => {
        realtimeRef.current = status === "SUBSCRIBED";
        setRealtimeOk(status === "SUBSCRIBED");
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, restaurant.id, refresh]);

  // Rezervni polling: svakih 10 s kad Realtime nije spojen, inače rijetka provjera za svaki slučaj.
  useEffect(() => {
    const tick = () => {
      const stale = Date.now() - lastRefreshRef.current > SAFETY_POLL_MS;
      if (!realtimeRef.current || stale) void refresh();
    };
    lastRefreshRef.current = Date.now();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Sat i status radnog vremena (nakon mounta, da server i klijent ne razilaze u renderu).
  useEffect(() => {
    const update = () => {
      setNow(Date.now());
      setHoursLabel(openStatusLabel(restaurant));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [restaurant]);

  useEffect(() => {
    const check = () => {
      setShowWakeHint(!readFlag(WAKE_HINT_KEY));
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      setShowInstallHint(!standalone && !readFlag(INSTALL_HINT_KEY));
    };
    check();
  }, []);

  const byStatus = (status: OrderStatus) => orders.filter((order) => order.status === status);
  const newOrders = byStatus("new");
  const columns: Record<Tab, AdminOrder[]> = { new: newOrders, accepted: byStatus("accepted"), ready: byStatus("ready") };

  // Zvuk: odmah kad stigne nova, zatim svakih ~20 s dok netko ne potvrdi ili odbije.
  const newCount = newOrders.length;
  const hasNew = newCount > 0;
  const previousCount = useRef(0);
  useEffect(() => {
    if (newCount > previousCount.current) chime.play();
    previousCount.current = newCount;
  }, [newCount, chime]);
  useEffect(() => {
    if (!hasNew || !chime.ready) return;
    const id = setInterval(chime.play, REPEAT_SOUND_MS);
    return () => clearInterval(id);
  }, [hasNew, chime.ready, chime.play]);
  useTitleBlink(newCount);

  const connected = realtimeOk || (lastPollOk > 0 && now - lastPollOk < CONNECTED_GRACE_MS);

  // Dnevni sažetak se računa tek nakon mounta (now > 0), da render ostane čist.
  const dayStart = now ? zagrebDayStart(new Date(now)) : null;
  const today = dayStart ? orders.filter((order) => new Date(order.createdAt) >= dayStart && order.status !== "rejected") : [];
  const todayTotal = today.reduce((sum, order) => sum + order.totalCents, 0);

  // Jedna izmjena statusa. `expected` štiti od dvostrukog klika i od dva uređaja istodobno.
  const update = async (order: AdminOrder, patch: Record<string, unknown>, expected: OrderStatus) => {
    setBusyId(order.id);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", order.id)
      .eq("status", expected)
      .select("id");
    if (updateError) setError("Nije uspjelo. Provjeri vezu i pokušaj ponovno.");
    else if (!data || data.length === 0) setError(`Narudžba ${order.shortCode} je u međuvremenu promijenjena.`);
    await refresh();
    setBusyId(null);
  };

  const togglePause = async () => {
    const next = !accepting;
    setError(null);
    const { data, error: pauseError } = await supabase
      .from("restaurants")
      .update({ accepting_orders: next })
      .eq("id", restaurant.id)
      .select("id");
    if (pauseError || !data?.length) setError("Promjena nije spremljena. Pokušaj ponovno.");
    else setAccepting(next);
  };

  return (
    <main className="mx-auto max-w-[1240px] px-3 pb-24 pt-3 sm:px-6">
      <div
        className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${connected ? "bg-green-50 text-green-700" : "bg-red-600 text-white"}`}
        role="status"
      >
        {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        {connected ? "Povezano" : "Nema veze, narudžbe mogu kasniti"}
      </div>

      {!chime.ready && (
        <button
          onClick={() => void chime.enable()}
          className={`${btn} mt-3 flex w-full items-center justify-center gap-2 bg-amber-500 text-lg text-white`}
        >
          <Volume2 className="h-6 w-6" /> Uključi zvuk
        </button>
      )}
      {!chime.ready && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0" /> Zvuk nije uključen — nove narudžbe nećete čuti.
        </p>
      )}

      {wake.unsupported && showWakeHint && (
        <Hint
          text="Postavite da ekran ostane upaljen (Postavke → Zaslon → Vrijeme do isključenja), jer ovaj preglednik to ne može sam."
          onClose={() => {
            writeFlag(WAKE_HINT_KEY, true);
            setShowWakeHint(false);
          }}
        />
      )}
      {showInstallHint && (
        <Hint
          title="Dodaj na početni zaslon"
          text="Android (Chrome): ⋮ → „Dodaj na početni zaslon”. iPhone (Safari): gumb Podijeli → „Dodaj na početni zaslon”. Tako se otvara kao aplikacija."
          onClose={() => {
            writeFlag(INSTALL_HINT_KEY, true);
            setShowInstallHint(false);
          }}
        />
      )}

      <section className="mt-3 rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow">
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
          <span className="text-base font-bold">Trenutno ne primamo narudžbe</span>
          <input
            type="checkbox"
            role="switch"
            checked={!accepting}
            onChange={() => void togglePause()}
            className="h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-black/20 transition-colors checked:bg-red-600 relative before:absolute before:left-1 before:top-1 before:h-6 before:w-6 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-6"
          />
        </label>
        <p className={`mt-1 text-sm ${accepting ? "text-[var(--muted)]" : "font-bold text-red-700"}`}>
          {accepting ? "Gosti mogu naručivati." : "Naručivanje je pauzirano — gosti vide natpis i ne mogu naručiti."}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <Clock className="h-4 w-4" /> Prema radnom vremenu: {hoursLabel || "…"}
        </p>
        <p className="mt-2 border-t border-black/5 pt-2 text-sm font-bold">
          Danas: {today.length} {ordersLabel(today.length)} · {formatEuro(todayTotal)}
        </p>
      </section>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`${btn} relative px-2 text-sm ${tab === key ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--foreground)] border border-[var(--border)]"}`}
          >
            {label}
            {columns[key].length > 0 && (
              <span className={`ml-1.5 rounded-full px-2 py-0.5 text-xs ${tab === key ? "bg-white/25" : "bg-black/10"}`}>{columns[key].length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {TABS.map(({ key, label }) => (
          <section key={key} className={`${tab === key ? "block" : "hidden"} md:block`}>
            <h2 className="mb-2 hidden items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--muted)] md:flex">
              {label} <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">{columns[key].length}</span>
            </h2>
            <div className="space-y-3">
              {columns[key].length === 0 && (
                <p className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-[var(--muted)]">
                  Nema narudžbi.
                </p>
              )}
              {columns[key].map((order) => (
                <OrderCard key={order.id} order={order} now={now} busy={busyId === order.id} onUpdate={update} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function Hint({ title, text, onClose }: { title?: string; text: string; onClose: () => void }) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <p className="flex-1">
        {title && <strong className="block">{title}</strong>}
        {text}
      </p>
      <button onClick={onClose} aria-label="Zatvori uputu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-blue-100">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function OrderCard({
  order,
  now,
  busy,
  onUpdate,
}: {
  order: AdminOrder;
  now: number;
  busy: boolean;
  onUpdate: (order: AdminOrder, patch: Record<string, unknown>, expected: OrderStatus) => Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "accept" | "reject">("idle");
  const [customReason, setCustomReason] = useState("");
  const minutes = now ? Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000)) : null;
  const late = order.status === "new" && minutes !== null && minutes >= 5;
  const pickup = order.pickupType === "time" && order.pickupTime ? `U ${formatTime(new Date(order.pickupTime))}` : "Što prije";

  const finish = (patch: Record<string, unknown>, expected: OrderStatus) => {
    setMode("idle");
    void onUpdate(order, patch, expected);
  };

  return (
    <article className={`rounded-2xl border-2 bg-white p-4 card-shadow ${late ? "border-red-400" : "border-[var(--border)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-black leading-none tracking-tight">{order.shortCode}</p>
          <p className="mt-1.5 truncate text-lg font-bold">{order.customerName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-extrabold">{formatEuro(order.totalCents)}</p>
          <p className={`mt-1 text-sm font-bold ${late ? "text-red-600" : "text-[var(--muted)]"}`}>
            {minutes === null ? "" : minutes === 0 ? "upravo sada" : `prije ${minutes} min`}
          </p>
        </div>
      </div>

      <a
        href={`tel:${order.customerPhone}`}
        className="mt-3 flex min-h-12 items-center gap-2 rounded-xl bg-black/[0.04] px-3 text-base font-bold"
      >
        <Phone className="h-5 w-5 text-[var(--brand)]" /> {order.customerPhone}
      </a>

      <p className="mt-3 text-base font-extrabold text-[var(--brand-dark)]">{pickup}</p>

      <ul className="mt-2 space-y-1.5 border-t border-black/5 pt-3">
        {order.items.map((item) => (
          <li key={item.id} className="text-base leading-snug">
            <span className="font-extrabold">{item.qty}×</span> {item.name}
            {item.options.length > 0 && <span className="block text-sm text-[var(--muted)]">{item.options.join(", ")}</span>}
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mt-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-base font-bold text-amber-900">
          Napomena: {order.note}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {order.status === "new" && mode === "idle" && (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => setMode("accept")} className={`${btn} bg-green-600 text-white`}>
              <Check className="mr-1 inline h-5 w-5" /> Potvrdi
            </button>
            <button disabled={busy} onClick={() => setMode("reject")} className={`${btn} bg-red-50 text-red-700`}>
              Odbij
            </button>
          </div>
        )}

        {order.status === "new" && mode === "accept" && (
          <div>
            <p className="mb-2 text-sm font-bold">Spremno za:</p>
            <div className="grid grid-cols-4 gap-2">
              {ETA_CHOICES.map((eta) => (
                <button
                  key={eta}
                  disabled={busy}
                  onClick={() => finish({ status: "accepted", eta_minutes: eta }, "new")}
                  className={`${btn} bg-green-600 px-1 text-white`}
                >
                  {eta}
                  <span className="block text-[11px] font-semibold opacity-90">min</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMode("idle")} className={`${btn} mt-2 w-full bg-black/[0.05]`}>
              Natrag
            </button>
          </div>
        )}

        {order.status === "new" && mode === "reject" && (
          <div className="space-y-2">
            <p className="text-sm font-bold">Razlog odbijanja:</p>
            {REJECT_REASONS.map((reason) => (
              <button
                key={reason}
                disabled={busy}
                onClick={() => finish({ status: "rejected", reject_reason: reason }, "new")}
                className={`${btn} w-full bg-red-50 text-red-700`}
              >
                {reason}
              </button>
            ))}
            <div className="flex gap-2">
              <input
                value={customReason}
                onChange={(event) => setCustomReason(event.target.value)}
                maxLength={120}
                placeholder="Drugi razlog…"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-black/15 px-3 text-base outline-none focus:border-[var(--brand)]"
              />
              <button
                disabled={busy || !customReason.trim()}
                onClick={() => finish({ status: "rejected", reject_reason: customReason.trim() }, "new")}
                className={`${btn} bg-red-600 text-white`}
              >
                Odbij
              </button>
            </div>
            <button onClick={() => setMode("idle")} className={`${btn} w-full bg-black/[0.05]`}>
              Natrag
            </button>
          </div>
        )}

        {order.status === "accepted" && (
          <div className="space-y-2">
            {order.etaMinutes && <p className="text-sm font-bold text-[var(--muted)]">Potvrđeno · spremno za ~{order.etaMinutes} min</p>}
            <button disabled={busy} onClick={() => void onUpdate(order, { status: "ready" }, "accepted")} className={`${btn} w-full bg-[var(--brand)] text-lg text-white`}>
              Spremno
            </button>
          </div>
        )}

        {order.status === "ready" && (
          <button disabled={busy} onClick={() => void onUpdate(order, { status: "done" }, "ready")} className={`${btn} w-full bg-green-600 text-lg text-white`}>
            Preuzeto
          </button>
        )}
      </div>
    </article>
  );
}
