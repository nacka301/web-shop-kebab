"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { demoOrders, menu, shop, type Order, type OrderStatus } from "@/data/demo";

const columns: { key: OrderStatus; label: string; color: string }[] = [
  { key: "nova", label: "Nove narudžbe", color: "bg-red-100 text-red-700" },
  { key: "u_pripremi", label: "U pripremi", color: "bg-amber-100 text-amber-700" },
  { key: "spremna", label: "Spremne", color: "bg-blue-100 text-blue-700" },
  { key: "preuzeta", label: "Preuzete", color: "bg-green-100 text-green-700" },
];
const nextStatus: Record<OrderStatus, OrderStatus> = { nova: "u_pripremi", u_pripremi: "spremna", spremna: "preuzeta", preuzeta: "preuzeta" };
const weekdays = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"];
type Schedule = { opening: string; closing: string; closed: boolean };
const defaultSchedule: Schedule = { opening: "10:00", closing: "23:00", closed: false };

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>(demoOrders);
  const [available, setAvailable] = useState<Record<string, boolean>>(Object.fromEntries(menu.map((item) => [item.id, item.available])));
  const [tab, setTab] = useState<"orders" | "menu" | "settings">("orders");
  const [schedule, setSchedule] = useState<Record<string, Schedule>>(
    Object.fromEntries(weekdays.map((day) => [day, { ...defaultSchedule }]))
  );
  const [isOpen, setIsOpen] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousNewOrders = useRef(demoOrders.filter((order) => order.status === "nova").length);
  const grouped = useMemo(() => columns.map((column) => ({ ...column, orders: orders.filter((order) => order.status === column.key) })), [orders]);
  const latestNewOrder = grouped[0]?.orders[0] ?? null;

  const advance = (id: string) => setOrders((current) => current.map((order) => order.id === id ? { ...order, status: nextStatus[order.status] } : order));
  const playNewOrderSound = () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.35);
  };
  useEffect(() => {
    const unlockSound = () => {
      if (audioContextRef.current) return;
      const audioContext = new AudioContext();
      void audioContext.resume();
      audioContextRef.current = audioContext;
    };
    window.addEventListener("pointerdown", unlockSound, { once: true });
    return () => window.removeEventListener("pointerdown", unlockSound);
  }, []);
  useEffect(() => {
    const newOrders = orders.filter((order) => order.status === "nova").length;
    if (newOrders > previousNewOrders.current) playNewOrderSound();
    previousNewOrders.current = newOrders;
  }, [orders]);
  const updateSchedule = (day: string, changes: Partial<Schedule>) => setSchedule((current) => ({
    ...current,
    [day]: { ...current[day], ...changes },
  }));
  const copyMondayToAll = () => setSchedule((current) => Object.fromEntries(weekdays.map((day) => [day, { ...current.Ponedjeljak }])));

  return <main className="min-h-screen bg-[#f7f7f4] text-[#171714]">
    <header className="border-b border-black/5 bg-white"><div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4"><div><Link href="/" className="text-xl font-black">mambo<span className="text-[var(--brand)]">.</span> <span className="ml-2 text-sm font-medium text-[var(--muted)]">Radnik</span></Link><p className="mt-1 text-xs text-[var(--muted)]">{shop.name}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="flex rounded-full border border-black/10 bg-black/[.03] p-1 text-xs font-bold"><Link href={`/${shop.slug}`} className="rounded-full px-3 py-1.5 text-[var(--muted)] transition hover:text-black">Kupac</Link><span className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-white">Radnik</span></div></div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-black/10"><button onClick={() => setTab("orders")} className={`whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-bold ${tab === "orders" ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)]"}`}>Narudžbe <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{orders.filter((order) => order.status === "nova").length}</span></button><button onClick={() => setTab("menu")} className={`whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-bold ${tab === "menu" ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)]"}`}>Meni</button><button onClick={() => setTab("settings")} className={`whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-bold ${tab === "settings" ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)]"}`}>Postavke radnje</button></div>
      {tab === "orders" ? <div className="space-y-4"><div className={`rounded-2xl border px-4 py-3 shadow-sm ${latestNewOrder ? "border-red-200 bg-red-50 text-red-800" : "border-black/5 bg-white text-[var(--muted)]"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider">{latestNewOrder ? "Nova narudžba na zaslonu" : "Nema novih narudžbi"}</p><p className="text-sm font-bold">{latestNewOrder ? `${latestNewOrder.id} · ${latestNewOrder.customer}` : "Čeka se nova narudžba."}</p></div><div className={`h-3 w-3 rounded-full ${latestNewOrder ? "animate-pulse bg-red-500" : "bg-black/15"}`} /></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{grouped.map((column) => <section key={column.key} className={`${column.key === "preuzeta" ? "rounded-2xl bg-black/[.03] p-3 sm:min-h-52" : "min-h-52 rounded-2xl bg-black/[.03] p-3"}`}><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">{column.label}</h2><span className={`rounded-full px-2 py-1 text-xs font-bold ${column.color}`}>{column.orders.length}</span></div><div className={column.key === "preuzeta" ? "max-h-80 space-y-3 overflow-y-auto sm:max-h-none" : "space-y-3"}>{column.orders.map((order) => <article key={order.id} className="rounded-xl bg-white p-4 shadow-sm"><div className="flex justify-between"><strong>{order.id}</strong><span className="text-xs text-[var(--muted)]">{order.createdAt}</span></div><h3 className="mt-3 font-bold">{order.customer}</h3><p className="mt-1 text-sm leading-5 text-[var(--muted)]">{order.items}</p><p className="mt-3 text-sm font-bold">{order.pickup} · {order.total.toFixed(2).replace(".", ",")} €</p>{order.note && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Napomena: {order.note}</p>}{order.status !== "preuzeta" && <button onClick={() => advance(order.id)} className="mt-3 w-full rounded-lg bg-black py-2 text-xs font-bold text-white">{order.status === "nova" ? "Primljeno" : order.status === "u_pripremi" ? "Spremno" : "Preuzeto"}</button>}</article>)}</div></section>)}</div></div> : tab === "menu" ? <div className="max-w-3xl space-y-3">{menu.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="text-3xl">{item.emoji}</span><div><h2 className="font-bold">{item.name}</h2><p className="text-sm text-[var(--muted)]">{item.category} · {item.price.toFixed(2).replace(".", ",")} €</p></div></div><button onClick={() => setAvailable((current) => ({ ...current, [item.id]: !current[item.id] }))} className={`rounded-full px-3 py-2 text-xs font-bold ${available[item.id] ? "bg-green-100 text-green-700" : "bg-black/10 text-[var(--muted)]"}`}>{available[item.id] ? "Dostupno" : "Nedostupno"}</button></div>)}</div> : <section className="max-w-3xl rounded-2xl bg-white p-5 shadow-sm sm:p-6"><div className="mb-6"><p className="text-xs font-black uppercase tracking-wider text-[var(--brand)]">Postavke</p><h2 className="mt-1 text-2xl font-black">Radno vrijeme i vidljivost radnje</h2><p className="mt-1 text-sm text-[var(--muted)]">Podesi raspored za svaki dan i odredi kada kupci mogu naručivati.</p></div><div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f7f7f4] p-4"><p className="text-xl font-black text-[var(--brand)]">{orders.filter((order) => order.status === "nova").length}</p><p className="text-xs font-bold">Nove narudžbe</p></div><div className="rounded-xl bg-[#f7f7f4] p-4"><p className="text-xl font-black text-green-600">{orders.reduce((sum, order) => sum + order.total, 0).toFixed(2).replace(".", ",")} €</p><p className="text-xs font-bold">Danas prodano</p></div><div className="rounded-xl bg-[#f7f7f4] p-4"><p className="text-xl font-black text-blue-600">{orders.length}</p><p className="text-xs font-bold">Ukupno narudžbi</p></div></div><div className="mb-6 flex items-center justify-between rounded-xl bg-[#f7f7f4] p-4"><div><p className="font-bold">Radnja je trenutno</p><p className="text-sm text-[var(--muted)]">{isOpen ? "Otvorena za narudžbe" : "Zatvorena za narudžbe"}</p></div><button onClick={() => setIsOpen((value) => !value)} className={`rounded-full px-3 py-2 text-xs font-black ${isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{isOpen ? "Otvoreno" : "Zatvoreno"}</button></div><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-black">Tjedni raspored</h3><button onClick={copyMondayToAll} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-bold">Kopiraj ponedjeljak na sve dane</button></div><div className="space-y-2">{weekdays.map((day) => <div key={day} className="grid gap-3 rounded-xl bg-[#f7f7f4] p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><span className="font-bold">{day}</span><label className="text-xs font-bold text-[var(--muted)]">Otvara se<input type="time" disabled={schedule[day].closed} value={schedule[day].opening} onChange={(event) => updateSchedule(day, { opening: event.target.value })} className="mt-1 w-full rounded-lg border border-black/10 bg-white p-2 text-sm text-black disabled:opacity-40" /></label><label className="text-xs font-bold text-[var(--muted)]">Zatvara se<input type="time" disabled={schedule[day].closed} value={schedule[day].closing} onChange={(event) => updateSchedule(day, { closing: event.target.value })} className="mt-1 w-full rounded-lg border border-black/10 bg-white p-2 text-sm text-black disabled:opacity-40" /></label><label className="flex items-center gap-2 text-sm font-bold sm:pt-4"><input type="checkbox" checked={schedule[day].closed} onChange={(event) => updateSchedule(day, { closed: event.target.checked })} className="h-4 w-4 accent-[var(--brand)]" /> Zatvoreno</label></div>)}</div><div className="mt-5 rounded-xl bg-[#fff0e8] p-4 text-sm text-[var(--brand-dark)]">Kupci će vidjeti raspored za cijeli tjedan na javnom meniju.</div><button onClick={() => setTab("orders")} className="mt-5 rounded-xl bg-black px-5 py-3 font-bold text-white">Spremi i natrag na narudžbe</button></section>}
    </div>
  </main>;
}
