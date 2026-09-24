"use client";

import { useMemo, useState } from "react";
import { demoOrders, menu, shop, type Order, type OrderStatus } from "@/data/demo";

const columns: { key: OrderStatus; label: string; color: string }[] = [
  { key: "nova", label: "Nove narudžbe", color: "bg-red-100 text-red-700" },
  { key: "u_pripremi", label: "U pripremi", color: "bg-amber-100 text-amber-700" },
  { key: "spremna", label: "Spremne", color: "bg-blue-100 text-blue-700" },
  { key: "preuzeta", label: "Preuzete", color: "bg-green-100 text-green-700" },
];
const nextStatus: Record<OrderStatus, OrderStatus> = { nova: "u_pripremi", u_pripremi: "spremna", spremna: "preuzeta", preuzeta: "preuzeta" };

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>(demoOrders);
  const [available, setAvailable] = useState<Record<string, boolean>>(Object.fromEntries(menu.map((item) => [item.id, item.available])));
  const [tab, setTab] = useState<"orders" | "menu">("orders");
  const grouped = useMemo(() => columns.map((column) => ({ ...column, orders: orders.filter((order) => order.status === column.key) })), [orders]);

  const advance = (id: string) => setOrders((current) => current.map((order) => order.id === id ? { ...order, status: nextStatus[order.status] } : order));

  return <main className="min-h-screen bg-[#f7f7f4] text-[#171714]">
    <header className="border-b border-black/5 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><div className="text-xl font-black">mambo<span className="text-[var(--brand)]">.</span> <span className="ml-2 text-sm font-medium text-[var(--muted)]">Admin</span></div><p className="mt-1 text-xs text-[var(--muted)]">{shop.name} · {shop.address}</p></div><a href={`/${shop.slug}`} className="rounded-lg border border-black/10 px-3 py-2 text-sm font-bold">Javni meni</a></div></header>
    <div className="mx-auto max-w-7xl px-5 py-6"><div className="mb-6"><h1 className="text-3xl font-black">Dobro jutro 👋</h1><p className="mt-1 text-[var(--muted)]">Upravljaj narudžbama i menijem.</p></div>
      <div className="mb-6 flex gap-2 border-b border-black/10"><button onClick={() => setTab("orders")} className={`border-b-2 px-3 pb-3 text-sm font-bold ${tab === "orders" ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)]"}`}>Narudžbe <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{orders.filter((order) => order.status === "nova").length}</span></button><button onClick={() => setTab("menu")} className={`border-b-2 px-3 pb-3 text-sm font-bold ${tab === "menu" ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)]"}`}>Meni</button></div>
      {tab === "orders" ? <div className="grid gap-4 lg:grid-cols-4">{grouped.map((column) => <section key={column.key} className="min-h-52 rounded-2xl bg-black/[.03] p-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">{column.label}</h2><span className={`rounded-full px-2 py-1 text-xs font-bold ${column.color}`}>{column.orders.length}</span></div><div className="space-y-3">{column.orders.map((order) => <article key={order.id} className="rounded-xl bg-white p-4 shadow-sm"><div className="flex justify-between"><strong>{order.id}</strong><span className="text-xs text-[var(--muted)]">{order.createdAt}</span></div><h3 className="mt-3 font-bold">{order.customer}</h3><p className="mt-1 text-sm leading-5 text-[var(--muted)]">{order.items}</p><p className="mt-3 text-sm font-bold">{order.pickup} · {order.total.toFixed(2).replace(".", ",")} €</p>{order.note && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Napomena: {order.note}</p>}{order.status !== "preuzeta" && <button onClick={() => advance(order.id)} className="mt-3 w-full rounded-lg bg-black py-2 text-xs font-bold text-white">Premjesti u: {columns.find((item) => item.key === nextStatus[order.status])?.label}</button>}</article>)}</div></section>)}</div> : <div className="max-w-3xl space-y-3">{menu.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="text-3xl">{item.emoji}</span><div><h2 className="font-bold">{item.name}</h2><p className="text-sm text-[var(--muted)]">{item.category} · {item.price.toFixed(2).replace(".", ",")} €</p></div></div><button onClick={() => setAvailable((current) => ({ ...current, [item.id]: !current[item.id] }))} className={`rounded-full px-3 py-2 text-xs font-bold ${available[item.id] ? "bg-green-100 text-green-700" : "bg-black/10 text-[var(--muted)]"}`}>{available[item.id] ? "Dostupno" : "Nedostupno"}</button></div>)}</div>}
    </div>
  </main>;
}
