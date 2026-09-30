"use client";

import { useEffect, useRef, useState } from "react";
import { menu, shop, type MenuItem } from "@/data/demo";

type CartItem = MenuItem & { quantity: number; sauces: string[]; sides: string[]; extras: string[]; size: string | null; unitPrice: number };
type OrderType = "pickup" | "delivery";
type Payment = "cash" | "card";
// Svaki "korak" (modal artikla, košarica, checkout, potvrda) je jedan unos u browser historiji,
// tako da tipka/gesta "natrag" zatvara samo taj korak umjesto da izađe iz cijele aplikacije.
type View = "menu" | "item" | "cart" | "checkout" | "confirmed";
const viewDepth: Record<View, number> = { menu: 0, item: 1, cart: 1, checkout: 2, confirmed: 3 };

const foodCategories = ["Smash burgeri", "Sendviči", "Ostalo"];
const minDelivery = 15;
const money = (value: number) => `${value.toFixed(2).replace(".", ",")} €`;
const signedMoney = (value: number) => (value > 0 ? `+ ${money(value)}` : value < 0 ? `− ${money(Math.abs(value))}` : "uključeno");
const orderTypeOptions: { key: OrderType; icon: string; label: string; sub: string }[] = [
  { key: "pickup", icon: "🏪", label: "Preuzimanje", sub: "U radnji · besplatno" },
  { key: "delivery", icon: "🛵", label: "Dostava", sub: "Besplatna dostava" },
];
const paymentOptions: { key: Payment; icon: string; label: string }[] = [
  { key: "cash", icon: "💶", label: "Gotovina" },
  { key: "card", icon: "💳", label: "Karticom online" },
];

export default function ShopPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSauce, setSelectedSauce] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [configQty, setConfigQty] = useState(1);
  const [showCart, setShowCart] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [category, setCategory] = useState("Sve");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [payment, setPayment] = useState<Payment>("cash");
  const [timeMode, setTimeMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledTime, setScheduledTime] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", note: "" });
  const currentViewRef = useRef<View>("menu");
  const [stepDir, setStepDir] = useState<"forward" | "back">("forward");

  const categories = ["Sve", ...Array.from(new Set(menu.map((item) => item.category)))];
  const visible = menu.filter((item) => item.available && (category === "Sve" || item.category === category));
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const isDelivery = orderType === "delivery";
  const total = subtotal;
  const deliveryRemaining = Math.max(0, minDelivery - subtotal);
  const deliveryBelowMin = isDelivery && subtotal < minDelivery;

  const sizeDelta = (item: MenuItem, label: string | null) => item.sizes?.find((size) => size.label === label)?.delta ?? 0;
  const extraCost = selectedItem ? selectedExtras.reduce((sum, name) => sum + (selectedItem.extraOptions?.find((e) => e.name === name)?.price ?? 0), 0) : 0;
  const unitConfigured = selectedItem ? selectedItem.price + sizeDelta(selectedItem, selectedSize) + extraCost : 0;
  const handoverLabel = isDelivery ? "pri dostavi" : "pri preuzimanju";
  const paymentSummary = payment === "card" ? "Karticom online" : `Gotovina ${handoverLabel}`;
  const timeLabel = isDelivery ? "Vrijeme dostave" : "Vrijeme preuzimanja";
  const asapLabel = isDelivery ? "≈ 30 min" : "≈ 15 min";
  const pickupSummary = timeMode === "scheduled" && scheduledTime ? `Zakazano za ${scheduledTime}` : `Što prije · ${asapLabel}`;

  // Koristimo URL hash (#item, #cart, ...) s praznim state-om umjesto vlastitog state objekta —
  // Next.js App Router interno upravlja history.state, pa bi vlastiti objekt tu izazvao pun reload.
  const pushView = (view: View) => {
    currentViewRef.current = view;
    window.history.pushState(null, "", `#${view}`);
  };
  const openCustomization = (item: MenuItem) => {
    setSelectedItem(item);
    setSelectedSauce(null);
    setSelectedSide(null);
    setSelectedExtras([]);
    setSelectedSize(item.sizes?.[0]?.label ?? null);
    setConfigQty(1);
    pushView("item");
  };
  const toggleChoice = (choice: string, selected: string[], setSelected: (value: string[]) => void) => {
    setSelected(selected.includes(choice) ? selected.filter((item) => item !== choice) : [...selected, choice]);
  };
  const addConfigured = () => {
    if (!selectedItem) return;
    setCart((current) => [...current, { ...selectedItem, id: `${selectedItem.id}-${Date.now()}`, quantity: configQty, sauces: selectedSauce ? [selectedSauce] : [], sides: selectedSide ? [selectedSide] : [], extras: selectedExtras, size: selectedSize, unitPrice: unitConfigured }]);
    window.history.back();
  };
  const changeQuantity = (id: string, amount: number) => setCart((current) => current.flatMap((item) => item.id === id ? (item.quantity + amount > 0 ? [{ ...item, quantity: item.quantity + amount }] : []) : [item]));
  const submitOrder = (event: React.FormEvent) => {
    event.preventDefault();
    if (deliveryBelowMin) return;
    // Demo: narudžba se ne šalje niti sprema — samo prikazujemo ekran potvrde.
    setOrderNo(`#${Math.floor(1000 + Math.random() * 9000)}`);
    setConfirmed(true);
    pushView("confirmed");
  };
  const resetOrder = () => {
    setCart([]);
    setShowCart(false);
    setCheckout(false);
    setConfirmed(false);
    setOrderType("pickup");
    setPayment("cash");
    setTimeMode("asap");
    setScheduledTime("");
    setCustomer({ name: "", phone: "", address: "", note: "" });
  };
  const startNewOrder = () => {
    resetOrder();
    currentViewRef.current = "menu";
    window.history.go(-viewDepth.confirmed);
  };
  const closeSheet = () => {
    const depth = confirmed ? viewDepth.confirmed : checkout ? viewDepth.checkout : viewDepth.cart;
    window.history.go(-depth);
  };

  // Prati back tipku/gestu preglednika: svaki korak (item modal, košarica, checkout, potvrda)
  // je zaseban unos u historiji, pa "natrag" zatvara samo taj korak, ne cijelu aplikaciju.
  useEffect(() => {
    // Očisti eventualni hash iz deep linka bez dodavanja novog unosa u historiju; ne diramo
    // history.state (Next.js ga sam postavlja) — mijenjamo samo URL.
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    const onPopState = () => {
      const newView = (window.location.hash.replace("#", "") || "menu") as View;
      const cameFromConfirmed = currentViewRef.current === "confirmed";
      currentViewRef.current = newView;
      if (cameFromConfirmed) {
        // Narudžba je već poslana — nema smisla vraćati se u formu, kreni ispočetka
        // i počisti preostale unose (cart/checkout) da idući "natrag" ne otvori praznu košaricu.
        resetOrder();
        const remaining = viewDepth[newView];
        currentViewRef.current = "menu";
        if (remaining > 0) window.history.go(-remaining);
        return;
      }
      if (newView === "cart") {
        setStepDir("back");
        setCheckout(false);
      } else if (newView === "checkout") {
        setCheckout(true);
        setShowCart(true);
      } else {
        setSelectedItem(null);
        setShowCart(false);
        setCheckout(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const orderTypeSelector = <div className="grid grid-cols-2 gap-2.5">{orderTypeOptions.map((option) => {
    const active = orderType === option.key;
    return <button type="button" key={option.key} onClick={() => setOrderType(option.key)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-[var(--brand)] bg-[#fff0e8]" : "border-black/[0.08] bg-black/[0.02] hover:bg-black/[0.04]"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${active ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--foreground)] shadow-sm"}`}>{option.key === "pickup" ? <StoreIcon /> : <ScooterIcon />}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight">{option.label}</span>
        <span className="block text-xs text-[var(--muted)]">{option.sub}</span>
      </span>
    </button>;
  })}</div>;
  const deliveryNote = isDelivery ? <div className={`mt-2 rounded-xl p-3 text-sm font-bold ${deliveryBelowMin ? "bg-red-50 text-red-700" : "bg-[#eef7ed] text-green-700"}`}>{deliveryBelowMin ? `Dodaj još ${money(deliveryRemaining)} do minimalnog iznosa za dostavu (${money(minDelivery)}).` : `Minimalni iznos za dostavu (${money(minDelivery)}) je ispunjen ✓`}</div> : null;

  return <main className="min-h-screen bg-[var(--background)] pb-28">
    <header className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/double-burger.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />
      <div className="relative mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl shadow-lg ring-1 ring-white/25 backdrop-blur-md">{shop.logo}</div>
          <div className="min-w-0 text-white">
            <h1 className="font-display truncate text-2xl font-extrabold leading-tight sm:text-3xl">{shop.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-semibold backdrop-blur-md"><span className="text-[var(--brand)]">★</span> {shop.rating}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/25 px-2.5 py-1 font-semibold text-green-50 backdrop-blur-md"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Otvoreno</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur-md">🕒 {shop.prepTime}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-medium text-white/85">
          <span className="inline-flex items-center gap-1.5">📍 {shop.address}</span>
          <span className="inline-flex items-center gap-1.5">🕒 {shop.hours}</span>
        </div>
      </div>
    </header>

    <section className="no-scrollbar sticky top-0 z-10 overflow-x-auto bg-[var(--background)]/90 px-5 py-3 backdrop-blur sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${category === item ? "bg-[var(--brand)] text-white shadow-sm shadow-[var(--brand)]/30" : "bg-black/[0.04] text-[var(--muted)] hover:bg-black/[0.08]"}`}>{item}</button>)}</div>
    </section>

    <section className="mx-auto grid max-w-6xl gap-3.5 px-5 py-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:gap-5 lg:px-12">
      {visible.map((item) => <article key={item.id} className="flex overflow-hidden rounded-2xl bg-[var(--surface)] card-shadow transition duration-200 hover:-translate-y-0.5 hover:card-shadow-lg">
        <ItemImage item={item} />
        <div className="flex min-w-0 flex-1 flex-col p-3.5">
          <h2 className="font-display text-base font-bold leading-tight">{item.name}</h2>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--muted)]">{item.description}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <strong className="text-lg font-extrabold text-[var(--brand)]">{item.sizes ? `od ${money(item.price)}` : money(item.price)}</strong>
            <button onClick={() => openCustomization(item)} aria-label={`Dodaj ${item.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-2xl leading-none text-white shadow-sm shadow-[var(--brand)]/40 transition hover:bg-[var(--brand-dark)] active:scale-90">+</button>
          </div>
        </div>
      </article>)}
    </section>

    {totalItems > 0 && !showCart && !selectedItem && <button onClick={() => { setShowCart(true); pushView("cart"); }} className="fixed bottom-5 left-1/2 z-20 flex w-[calc(100%-2.5rem)] max-w-[26rem] -translate-x-1/2 items-center justify-between rounded-2xl bg-[var(--brand)] px-5 py-4 font-bold text-white shadow-xl shadow-[var(--brand)]/30 safe-bottom active:scale-[0.98]">
      <span>{totalItems} {totalItems === 1 ? "stavka" : "stavke"}</span>
      <span>Košarica · {money(subtotal)}</span>
    </button>}

    {selectedItem && <div className="anim-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => window.history.back()}>
      <div onClick={(event) => event.stopPropagation()} className="anim-sheet flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[var(--background)] sm:rounded-3xl sm:shadow-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative">
            {selectedItem.image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={selectedItem.image} alt={selectedItem.name} className="h-40 w-full object-cover" />
              : <div className="flex h-40 w-full items-center justify-center bg-[#f3ede6] text-6xl">{selectedItem.emoji}</div>}
            <button onClick={() => window.history.back()} aria-label="Zatvori" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-xl text-[var(--foreground)] shadow-md backdrop-blur">×</button>
          </div>

          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand)]">Prilagodi narudžbu</p>
            <h2 className="font-display text-2xl font-extrabold leading-tight">{selectedItem.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{selectedItem.description}</p>

            {selectedItem.sizes && <section className="mt-5">
              <h3 className="font-display text-base font-bold">Veličina</h3>
              <div className="mt-2 overflow-hidden rounded-2xl bg-white card-shadow">{selectedItem.sizes.map((size, index) => <button key={size.label} onClick={() => setSelectedSize(size.label)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                <span className="text-sm font-semibold">{size.label}</span>
                <span className="flex items-center gap-3"><span className="text-xs text-[var(--muted)]">{signedMoney(size.delta)}</span><Radio active={selectedSize === size.label} /></span>
              </button>)}</div>
            </section>}

            {selectedItem.sauceOptions && selectedItem.sauceOptions.length > 0 && <section className="mt-5">
              <h3 className="font-display text-base font-bold">Odaberi umak <span className="ml-1 text-xs font-normal text-[var(--muted)]">(odaberi 1, po želji)</span></h3>
              <div className="mt-2 overflow-hidden rounded-2xl bg-white card-shadow">{selectedItem.sauceOptions.map((sauce, index) => <button key={sauce} onClick={() => setSelectedSauce(selectedSauce === sauce ? null : sauce)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                <span className="text-sm font-semibold">{sauce}</span>
                <Radio active={selectedSauce === sauce} />
              </button>)}</div>
            </section>}

            {selectedItem.sideOptions && selectedItem.sideOptions.length > 0 && <section className="mt-5">
              <h3 className="font-display text-base font-bold">Prilog <span className="ml-1 text-xs font-normal text-[var(--muted)]">(odaberi 1, po želji)</span></h3>
              <div className="mt-2 overflow-hidden rounded-2xl bg-white card-shadow">{selectedItem.sideOptions.map((side, index) => <button key={side} onClick={() => setSelectedSide(selectedSide === side ? null : side)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                <span className="text-sm font-semibold">{side}</span>
                <Radio active={selectedSide === side} />
              </button>)}</div>
            </section>}

            {selectedItem.extraOptions && selectedItem.extraOptions.length > 0 && <section className="mt-5">
              <h3 className="font-display text-base font-bold">Dodaci <span className="ml-1 text-xs font-normal text-[var(--muted)]">(odaberi više)</span></h3>
              <div className="mt-2 overflow-hidden rounded-2xl bg-white card-shadow">{selectedItem.extraOptions.map((extra, index) => {
                const on = selectedExtras.includes(extra.name);
                return <button key={extra.name} onClick={() => toggleChoice(extra.name, selectedExtras, setSelectedExtras)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                  <span className="text-sm font-semibold">{extra.name}</span>
                  <span className="flex items-center gap-3">{extra.price > 0 && <span className="text-xs font-semibold text-[var(--brand-dark)]">+ {money(extra.price)}</span>}<Checkbox active={on} /></span>
                </button>;
              })}</div>
            </section>}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-black/[0.06] bg-white/95 p-4 backdrop-blur safe-bottom">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/[0.05] p-1">
            <button onClick={() => setConfigQty((q) => Math.max(1, q - 1))} aria-label="Smanji količinu" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl shadow-sm active:scale-90">−</button>
            <span className="w-7 text-center font-bold">{configQty}</span>
            <button onClick={() => setConfigQty((q) => q + 1)} aria-label="Povećaj količinu" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl shadow-sm active:scale-90">+</button>
          </div>
          <button onClick={addConfigured} className="flex flex-1 items-center justify-center rounded-full bg-[var(--brand)] py-3.5 font-bold text-white shadow-lg shadow-[var(--brand)]/30 transition hover:bg-[var(--brand-dark)] active:scale-[0.98]">Dodaj u košaricu · {money(unitConfigured * configQty)}</button>
        </div>
      </div>
    </div>}

    {showCart && <div className="anim-backdrop fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={closeSheet}>
      <div onClick={(event) => event.stopPropagation()} className="anim-sheet max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--background)] p-5 safe-bottom sm:rounded-3xl sm:shadow-2xl">
        {confirmed ? <div key="confirmed" className="anim-step-right py-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
          <h2 className="text-2xl font-black">Hvala na narudžbi!</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--muted)]">Narudžba <strong className="text-black">{orderNo}</strong> poslana je u {shop.name}. Radnja će uskoro potvrditi narudžbu.</p>
          <div className="mt-5 space-y-2 rounded-2xl bg-white p-4 text-left text-sm shadow-sm">
            <div className="flex justify-between gap-3"><span className="text-[var(--muted)]">Način</span><strong className="text-right">{isDelivery ? "Dostava" : "Preuzimanje u radnji"}</strong></div>
            {isDelivery && <div className="flex justify-between gap-3"><span className="text-[var(--muted)]">Adresa</span><strong className="text-right">{customer.address}</strong></div>}
            <div className="flex justify-between gap-3"><span className="text-[var(--muted)]">{isDelivery ? "Dostava" : "Preuzimanje"}</span><strong className="text-right">{pickupSummary}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-[var(--muted)]">Na ime</span><strong className="text-right">{customer.name}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-[var(--muted)]">Plaćanje</span><strong className="text-right">{paymentSummary}</strong></div>
            <div className="mt-2 space-y-0.5 border-t border-black/5 pt-2">{cart.map((item) => <div key={item.id} className="flex justify-between gap-3"><span>{item.quantity}× {item.name}{item.size ? ` (${item.size})` : ""}</span><span className="whitespace-nowrap">{money(item.unitPrice * item.quantity)}</span></div>)}</div>
            {isDelivery && <div className="flex justify-between border-t border-black/5 pt-2 text-[var(--muted)]"><span>Dostava</span><span>Besplatno</span></div>}
            <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black"><span>Ukupno</span><span>{money(total)}</span></div>
          </div>
          <button onClick={startNewOrder} className="mt-5 w-full rounded-xl bg-[var(--brand)] py-4 font-bold text-white transition active:scale-[0.98]">Nova narudžba</button>
        </div> : <div key={checkout ? "checkout" : "cart"} className={stepDir === "forward" ? "anim-step-right" : "anim-step-left"}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black">{checkout ? "Podaci za narudžbu" : "Tvoja košarica"}</h2>
            <button onClick={closeSheet} className="text-2xl text-[var(--muted)]" aria-label="Zatvori">×</button>
          </div>
          {!checkout ? <>
            <div className="mb-4">{orderTypeSelector}{deliveryNote}</div>
            <div className="overflow-hidden rounded-2xl bg-white card-shadow">{cart.map((item, index) => {
              const details = [...item.sauces, ...item.sides, ...item.extras].join(", ") || (foodCategories.includes(item.category) ? "Bez dodataka" : "");
              return <div key={item.id} className={`flex items-center gap-3 p-3.5 ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">{item.name}{item.size ? <span className="font-normal text-[var(--muted)]"> · {item.size}</span> : ""}</p>
                  {details && <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{details}</p>}
                </div>
                <span className="shrink-0 font-bold tabular-nums">{money(item.unitPrice * item.quantity)}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => changeQuantity(item.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-lg leading-none transition active:scale-90" aria-label="Smanji količinu">−</button>
                  <span className="w-5 text-center font-semibold tabular-nums">{item.quantity}</span>
                  <button onClick={() => changeQuantity(item.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-lg leading-none transition active:scale-90" aria-label="Povećaj količinu">+</button>
                </div>
              </div>;
            })}</div>
            <div className="mt-5 border-t border-black/10 pt-4">
              {isDelivery && <div className="mb-1.5 flex justify-between text-sm text-[var(--muted)]"><span>Dostava</span><span className="font-semibold text-green-700">Besplatno</span></div>}
              <div className="flex items-baseline justify-between"><span className="text-lg font-bold">Ukupno</span><span className="text-2xl font-extrabold">{money(total)}</span></div>
            </div>
            <button onClick={() => { setStepDir("forward"); setCheckout(true); pushView("checkout"); }} disabled={deliveryBelowMin} className={`mt-4 w-full rounded-xl py-4 font-bold text-white transition ${deliveryBelowMin ? "cursor-not-allowed bg-black/20" : "bg-[var(--brand)] active:scale-[0.98]"}`}>{deliveryBelowMin ? `Nedostaje ${money(deliveryRemaining)} za dostavu` : "Nastavi na podatke"}</button>
          </> : <form onSubmit={submitOrder} className="space-y-3">
            <div>{orderTypeSelector}{deliveryNote}</div>
            <p className="text-sm text-[var(--muted)]">Unesi podatke za pripremu narudžbe. Polja označena <span className="font-bold text-red-500">*</span> su obavezna.</p>
            {isDelivery && <label className="block text-sm font-bold">Adresa dostave <span className="text-red-500">*</span><input required value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} placeholder="Ulica i kućni broj, kat/stan" className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 outline-none transition placeholder:text-black/30 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20" /></label>}
            <label className="block text-sm font-bold">Ime i prezime <span className="text-red-500">*</span><input required pattern="^\s*\S+\s+\S+.*$" title="Upiši ime i prezime." value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Npr. Ivan Horvat" className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 outline-none transition placeholder:text-black/30 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20" /></label>
            <label className="block text-sm font-bold">Broj mobitela <span className="text-red-500">*</span><input required type="tel" pattern="^(?:\+385|0)9[\s\d\-]{7,}$" title="Upiši ispravan broj mobitela, npr. 091 123 4567." value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="091 123 4567" className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 outline-none transition placeholder:text-black/30 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20" /></label>
            <div>
              <p className="mb-1 text-sm font-bold">{timeLabel}</p>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setTimeMode("asap")} className={`relative rounded-2xl p-3 pr-8 text-left transition ${timeMode === "asap" ? "border-2 border-[var(--brand)] bg-[#fff0e8]" : "border border-black/[0.08] bg-black/[0.02]"}`}>
                  <span className="block text-sm font-bold">Što prije</span>
                  <span className="block text-xs text-[var(--muted)]">Standardno · {asapLabel}</span>
                  {timeMode === "asap" && <CheckBadge />}
                </button>
                <button type="button" onClick={() => setTimeMode("scheduled")} className={`relative rounded-2xl p-3 pr-8 text-left transition ${timeMode === "scheduled" ? "border-2 border-[var(--brand)] bg-[#fff0e8]" : "border border-black/[0.08] bg-black/[0.02]"}`}>
                  <span className="block text-sm font-bold">Zakaži za kasnije</span>
                  <span className="block text-xs text-[var(--muted)]">Odaberi vrijeme</span>
                  {timeMode === "scheduled" && <CheckBadge />}
                </button>
              </div>
              {timeMode === "scheduled" && <input required type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 bg-white p-3 text-black outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20" />}
            </div>
            <div>
              <p className="mb-1 text-sm font-bold">Način plaćanja</p>
              <div className="grid grid-cols-2 gap-2.5">{paymentOptions.map((option) => <button type="button" key={option.key} onClick={() => setPayment(option.key)} className={`relative flex items-center gap-2 rounded-2xl p-3 pr-8 text-sm font-bold transition ${payment === option.key ? "border-2 border-[var(--brand)] bg-[#fff0e8] text-[var(--brand-dark)]" : "border border-black/[0.08] bg-black/[0.02]"}`}>
                <span className="text-lg">{option.icon}</span>{option.label}
                {payment === option.key && <CheckBadge />}
              </button>)}</div>
            </div>
            <label className="block text-sm font-bold">Napomena <span className="font-normal text-[var(--muted)]">(opcionalno)</span><textarea value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} rows={4} placeholder="Npr. bez luka, dostava na stražnji ulaz…" className="mt-1 h-28 w-full resize-none rounded-xl border border-black/10 bg-white p-3 outline-none transition placeholder:text-black/30 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20" /></label>
            <div className="rounded-xl bg-[#fff0e8] p-3 text-sm text-[var(--brand-dark)]">{payment === "card" ? <>Plaćate <strong>online karticom</strong> pri narudžbi.</> : <>Plaćate <strong>gotovinom {handoverLabel}</strong>.</>}{isDelivery ? " Besplatna dostava." : ""}</div>
            <button disabled={deliveryBelowMin} className={`w-full rounded-xl py-4 font-bold text-white transition ${deliveryBelowMin ? "cursor-not-allowed bg-black/20" : "bg-[var(--brand)] active:scale-[0.98]"}`}>{deliveryBelowMin ? `Nedostaje ${money(deliveryRemaining)} za dostavu` : `Potvrdi narudžbu · ${money(total)}`}</button>
            <button type="button" onClick={() => window.history.back()} className="w-full rounded-xl border border-black/10 bg-white py-3.5 text-sm font-bold text-[var(--muted)] transition hover:bg-black/[.03] active:scale-[0.98]">← Natrag na košaricu</button>
          </form>}
        </div>}
      </div>
    </div>}
  </main>;
}

function CheckBadge() {
  return <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-white"><svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}

function StoreIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 4h16l1.5 5H2.5L4 4Z" />
    <path d="M4.5 9v11h15V9" />
    <path d="M9.5 20v-6h5v6" />
  </svg>;
}

function ScooterIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8.5 18h6.5" />
    <path d="M15 18l-2.5-8H10.5" />
    <path d="M13.5 10.5H17l2.5 5" />
    <path d="M5.5 12h3l1.2 3" />
  </svg>;
}

function Radio({ active }: { active: boolean }) {
  return <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${active ? "border-[var(--brand)]" : "border-black/20"}`}>{active && <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />}</span>;
}

function Checkbox({ active }: { active: boolean }) {
  return <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${active ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-black/20"}`}>{active && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>;
}

function ItemImage({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false);
  if (item.image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.image} alt={item.name} loading="lazy" onError={() => setFailed(true)} className="w-24 shrink-0 self-stretch bg-[#f3ede6] object-cover sm:w-28" />
    );
  }
  return <div className="flex w-24 shrink-0 items-center justify-center self-stretch bg-[#f3ede6] text-4xl sm:w-28">{item.emoji}</div>;
}
