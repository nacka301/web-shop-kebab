"use client";

import Link from "next/link";
import { useState } from "react";
import { menu, shop, type MenuItem } from "@/data/demo";

type CartItem = MenuItem & { quantity: number; sauces: string[]; extras: string[]; size: string | null; unitPrice: number };
const sauces = ["Blagi", "Ljuti", "Majoneza", "Kečap"];
const extras = ["Salata", "Luk", "Kupus", "Krastavac", "Feferoni"];
const foodCategories = ["Kebab", "Ostalo"];
const money = (value: number) => `${value.toFixed(2).replace(".", ",")} €`;
const signedMoney = (value: number) => (value > 0 ? `+ ${money(value)}` : value < 0 ? `− ${money(Math.abs(value))}` : "uključeno");
const productTags: Record<string, string[]> = {
  "small-kebab": ["Piletina", "Salata", "Luk", "Umak"],
  "large-kebab": ["Više mesa", "Salata", "Luk", "Umak"],
  "salad-kebab": ["Kebab meso", "Svježa salata", "Umak"],
  "hot-dog": ["Hrenovka", "Pecivo", "Umak"],
  box: ["Meso", "Pomfrit", "Salata", "Umak"],
  fries: ["Hrskavi pomfrit"],
  cola: ["Ohlađeno piće"],
};

export default function ShopPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [category, setCategory] = useState("Sve");
  const [customer, setCustomer] = useState({ name: "", phone: "", note: "", pickup: "Što prije (oko 15 min)" });

  const categories = ["Sve", ...Array.from(new Set(menu.map((item) => item.category)))];
  const visible = menu.filter((item) => item.available && (category === "Sve" || item.category === category));
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const sizeDelta = (item: MenuItem, label: string | null) => item.sizes?.find((size) => size.label === label)?.delta ?? 0;
  const isFood = selectedItem ? foodCategories.includes(selectedItem.category) : false;
  const configuredPrice = selectedItem ? selectedItem.price + sizeDelta(selectedItem, selectedSize) : 0;

  const openCustomization = (item: MenuItem) => {
    setSelectedItem(item);
    setSelectedSauces([]);
    setSelectedExtras([]);
    setSelectedSize(item.sizes?.[0]?.label ?? null);
  };
  const toggleChoice = (choice: string, selected: string[], setSelected: (value: string[]) => void) => {
    setSelected(selected.includes(choice) ? selected.filter((item) => item !== choice) : [...selected, choice]);
  };
  const addConfigured = () => {
    if (!selectedItem) return;
    setCart((current) => [...current, { ...selectedItem, id: `${selectedItem.id}-${Date.now()}`, quantity: 1, sauces: selectedSauces, extras: selectedExtras, size: selectedSize, unitPrice: configuredPrice }]);
    setSelectedItem(null);
  };
  const changeQuantity = (id: string, amount: number) => setCart((current) => current.flatMap((item) => item.id === id ? (item.quantity + amount > 0 ? [{ ...item, quantity: item.quantity + amount }] : []) : [item]));
  const submitOrder = (event: React.FormEvent) => {
    event.preventDefault();
    // Demo: narudžba se ne šalje niti sprema — samo prikazujemo ekran potvrde.
    setOrderNo(`#${Math.floor(1000 + Math.random() * 9000)}`);
    setConfirmed(true);
  };
  const resetOrder = () => {
    setCart([]);
    setShowCart(false);
    setCheckout(false);
    setConfirmed(false);
    setCustomer({ name: "", phone: "", note: "", pickup: "Što prije (oko 15 min)" });
  };
  const closeSheet = () => (confirmed ? resetOrder() : setShowCart(false));

  return <main className="min-h-screen bg-[#f7f7f4] pb-28">
    <header className="bg-[#171714] px-4 py-5 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-2">
        <Link href="/" className="shrink-0 text-2xl font-black tracking-tight" aria-label="Povratak na glavnu stranicu">mambo<span className="text-[var(--brand)]">.</span></Link>
        <div className="flex rounded-full border border-white/15 bg-white/5 p-1 text-[11px] font-bold sm:text-xs">
          <span className="rounded-full bg-[var(--brand)] px-2.5 py-1.5 text-white sm:px-3">Kupac</span>
          <a href={`/${shop.slug}/admin`} className="rounded-full px-2.5 py-1.5 text-white/60 transition hover:text-white sm:px-3">Radnik</a>
        </div>
      </div>
    </header>

    <section className="bg-[#171714] px-4 pb-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)] text-4xl shadow-lg sm:h-20 sm:w-20">{shop.logo}</div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black sm:text-3xl">{shop.name}</h1>
          <p className="mt-0.5 text-sm text-white/70">{shop.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
            <span className="flex items-center gap-1 font-bold text-white"><span className="text-[var(--brand)]">★</span> {shop.rating}</span>
            <span>· {shop.prepTime}</span>
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-bold text-green-400">Otvoreno</span>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-6xl text-sm leading-6 text-white/70">{shop.description}</p>
      <p className="mx-auto mt-2 max-w-6xl text-xs text-white/50">{shop.address} · {shop.hours}</p>
    </section>

    <section className="sticky top-0 z-10 overflow-x-auto border-b border-black/5 bg-[#f7f7f4]/95 px-5 py-4 backdrop-blur sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${category === item ? "bg-black text-white" : "bg-white text-[var(--muted)]"}`}>{item}</button>)}</div>
    </section>

    <section className="mx-auto grid max-w-6xl gap-3 px-5 py-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:gap-5 lg:px-12">
      {visible.map((item) => <article key={item.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm sm:p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-4xl sm:h-24 sm:w-24">{item.emoji}</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{item.name}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">{(productTags[item.id] ?? []).map((tag, index) => <span key={tag} className={`rounded-full px-2 py-1 text-[10px] font-bold ${index % 3 === 0 ? "bg-[#fff0e8] text-[var(--brand-dark)]" : index % 3 === 1 ? "bg-[#eef7ed] text-green-700" : "bg-[#eef2ff] text-blue-700"}`}>{tag}</span>)}</div>
          <div className="mt-3 flex items-center justify-between">
            <strong>{item.sizes ? `od ${money(item.price)}` : money(item.price)}</strong>
            <button onClick={() => openCustomization(item)} className="rounded-lg bg-[#fff0e8] px-3 py-1.5 text-sm font-bold text-[var(--brand-dark)]">+ Dodaj</button>
          </div>
        </div>
      </article>)}
    </section>

    {totalItems > 0 && !showCart && !selectedItem && <button onClick={() => setShowCart(true)} className="fixed bottom-5 left-1/2 z-20 flex w-[calc(100%-2.5rem)] max-w-[26rem] -translate-x-1/2 items-center justify-between rounded-2xl bg-[var(--brand)] px-5 py-4 font-bold text-white shadow-xl safe-bottom">
      <span>{totalItems} {totalItems === 1 ? "stavka" : "stavke"}</span>
      <span>Košarica · {money(total)}</span>
    </button>}

    {selectedItem && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelectedItem(null)}>
      <div onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-1/2 max-h-[92vh] w-full max-w-md -translate-x-1/2 overflow-y-auto rounded-t-3xl bg-[#f7f7f4] p-5">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--brand)]">Prilagodi narudžbu</p>
            <h2 className="text-2xl font-black">{selectedItem.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{selectedItem.description}</p>
          </div>
          <button onClick={() => setSelectedItem(null)} className="text-2xl text-[var(--muted)]">×</button>
        </div>

        {selectedItem.sizes && <>
          <h3 className="mb-2 font-black">Veličina</h3>
          <div className="mb-5 grid grid-cols-2 gap-2">{selectedItem.sizes.map((size) => <button key={size.label} onClick={() => setSelectedSize(size.label)} className={`rounded-xl border p-3 text-left text-sm font-bold ${selectedSize === size.label ? "border-[var(--brand)] bg-[#fff0e8] text-[var(--brand-dark)]" : "border-black/5 bg-white"}`}>{size.label}<span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">{signedMoney(size.delta)}</span></button>)}</div>
        </>}

        {isFood && <>
          <h3 className="mb-2 font-black">Odaberi umak</h3>
          <div className="mb-5 grid grid-cols-2 gap-2">{sauces.map((sauce) => <button key={sauce} onClick={() => toggleChoice(sauce, selectedSauces, setSelectedSauces)} className={`rounded-xl border p-3 text-left text-sm font-bold ${selectedSauces.includes(sauce) ? "border-[var(--brand)] bg-[#fff0e8] text-[var(--brand-dark)]" : "border-black/5 bg-white"}`}>{selectedSauces.includes(sauce) ? "✓ " : ""}{sauce}</button>)}</div>
          <h3 className="mb-2 font-black">Prilozi</h3>
          <p className="mb-2 text-xs text-[var(--muted)]">Možeš odabrati više priloga.</p>
          <div className="mb-6 grid grid-cols-2 gap-2">{extras.map((extra) => <button key={extra} onClick={() => toggleChoice(extra, selectedExtras, setSelectedExtras)} className={`rounded-xl border p-3 text-left text-sm font-bold ${selectedExtras.includes(extra) ? "border-[var(--brand)] bg-[#fff0e8] text-[var(--brand-dark)]" : "border-black/5 bg-white"}`}>{selectedExtras.includes(extra) ? "✓ " : ""}{extra}</button>)}</div>
        </>}

        <button onClick={addConfigured} className="w-full rounded-xl bg-[var(--brand)] py-4 font-bold text-white">Dodaj u košaricu · {money(configuredPrice)}</button>
      </div>
    </div>}

    {showCart && <div className="fixed inset-0 z-30 bg-black/40" onClick={closeSheet}>
      <div onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-1/2 max-h-[90vh] w-full max-w-md -translate-x-1/2 overflow-y-auto rounded-t-3xl bg-[#f7f7f4] p-5">
        {confirmed ? <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
          <h2 className="text-2xl font-black">Hvala na narudžbi!</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--muted)]">Narudžba <strong className="text-black">{orderNo}</strong> poslana je u {shop.name}. Radnja će uskoro potvrditi narudžbu.</p>
          <div className="mt-5 space-y-2 rounded-2xl bg-white p-4 text-left text-sm shadow-sm">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Preuzimanje</span><strong>{customer.pickup}</strong></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">Na ime</span><strong>{customer.name}</strong></div>
            <div className="mt-2 border-t border-black/5 pt-2">{cart.map((item) => <div key={item.id} className="flex justify-between py-0.5"><span>{item.quantity}× {item.name}{item.size ? ` (${item.size})` : ""}</span><span>{money(item.unitPrice * item.quantity)}</span></div>)}</div>
            <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black"><span>Ukupno</span><span>{money(total)}</span></div>
          </div>
          <div className="mt-4 rounded-xl bg-[#fff0e8] p-3 text-sm text-[var(--brand-dark)]">Plaćanje prilikom preuzimanja.</div>
          <button onClick={resetOrder} className="mt-5 w-full rounded-xl bg-[var(--brand)] py-4 font-bold text-white">Nova narudžba</button>
        </div> : <>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black">{checkout ? "Podaci za narudžbu" : "Tvoja košarica"}</h2>
            <button onClick={() => setShowCart(false)} className="text-2xl text-[var(--muted)]">×</button>
          </div>
          {!checkout ? <>
            <div className="space-y-3">{cart.map((item) => <div key={item.id} className="rounded-xl bg-white p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{item.name}{item.size ? <span className="text-[var(--muted)]"> · {item.size}</span> : ""}</p>
                  <p className="text-sm text-[var(--muted)]">{[...item.sauces, ...item.extras].join(", ") || (foodCategories.includes(item.category) ? "Bez dodataka" : "")}</p>
                  <p className="text-sm text-[var(--muted)]">{money(item.unitPrice)} · {item.quantity} kom</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQuantity(item.id, -1)} className="h-8 w-8 rounded-full bg-black/5" aria-label="Smanji količinu">−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => changeQuantity(item.id, 1)} className="h-8 w-8 rounded-full bg-black/5" aria-label="Povećaj količinu">+</button>
                </div>
              </div>
            </div>)}</div>
            <div className="my-5 flex justify-between text-lg font-black"><span>Ukupno</span><span>{money(total)}</span></div>
            <button onClick={() => setCheckout(true)} className="w-full rounded-xl bg-[var(--brand)] py-4 font-bold text-white">Nastavi na podatke</button>
          </> : <form onSubmit={submitOrder} className="space-y-3">
            <div className="rounded-xl bg-[#fff0e8] p-3 text-sm text-[var(--brand-dark)]">Za potvrdu narudžbe obavezni su ime i prezime te broj mobitela.</div>
            <label className="block text-sm font-bold">Ime i prezime<input required pattern="^\s*\S+\s+\S+.*$" title="Upiši ime i prezime." value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Npr. Ivan Horvat" className="mt-1 w-full rounded-xl border-0 bg-white p-3 outline-none ring-[var(--brand)] focus:ring-2" /></label>
            <label className="block text-sm font-bold">Broj mobitela<input required type="tel" pattern="^(?:\+385|0)9[\s\d\-]{7,}$" title="Upiši ispravan broj mobitela, npr. 091 123 4567." value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="091 123 4567" className="mt-1 w-full rounded-xl border-0 bg-white p-3 outline-none ring-[var(--brand)] focus:ring-2" /></label>
            <label className="block text-sm font-bold">Vrijeme preuzimanja<select value={customer.pickup} onChange={(event) => setCustomer({ ...customer, pickup: event.target.value })} className="mt-1 w-full rounded-xl border-0 bg-white p-3"><option>Što prije (oko 15 min)</option><option>Za 30 min</option><option>Za 45 min</option><option>Za 60 min</option></select></label>
            <label className="block text-sm font-bold">Napomena <span className="font-normal text-[var(--muted)]">(opcionalno)</span><textarea value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} placeholder="Npr. bez luka" className="mt-1 h-20 w-full resize-none rounded-xl border-0 bg-white p-3 outline-none ring-[var(--brand)] focus:ring-2" /></label>
            <div className="rounded-xl bg-[#fff0e8] p-3 text-sm text-[var(--brand-dark)]">Plaćanje: <strong>prilikom preuzimanja</strong></div>
            <button className="w-full rounded-xl bg-[var(--brand)] py-4 font-bold text-white">Potvrdi narudžbu · {money(total)}</button>
            <button type="button" onClick={() => setCheckout(false)} className="w-full py-2 text-center text-sm font-bold text-[var(--muted)] underline">← Natrag na košaricu</button>
          </form>}
        </>}
      </div>
    </div>}
  </main>;
}
