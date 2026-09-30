"use client";

import { useEffect, useRef, useState } from "react";
import { menu, shop, type MenuItem } from "@/data/demo";
import { Bike, Banknote, CheckCircle2, Clock, CreditCard, Flame, Minus, MapPin, Plus, Search, ShieldCheck, ShoppingBag, Store, Wallet, X } from "lucide-react";

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
const orderTypeOptions: { key: OrderType; Icon: typeof Store; label: string; sub: string }[] = [
  { key: "pickup", Icon: Store, label: "Preuzimanje", sub: "U radnji · besplatno" },
  { key: "delivery", Icon: Bike, label: "Dostava", sub: "Besplatna dostava" },
];
const paymentOptions: { key: Payment; Icon: typeof Banknote; label: string }[] = [
  { key: "cash", Icon: Banknote, label: "Gotovina" },
  { key: "card", Icon: CreditCard, label: "Karticom online" },
];

function isOpenNow() {
  const now = new Date();
  if (shop.closedWeekdays.includes(now.getDay())) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = shop.hoursStart.split(":").map(Number);
  const [closeH, closeM] = shop.hoursEnd.split(":").map(Number);
  return minutesNow >= openH * 60 + openM && minutesNow < closeH * 60 + closeM;
}

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
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [payment, setPayment] = useState<Payment>("cash");
  const [timeMode, setTimeMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledTime, setScheduledTime] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", note: "" });
  const currentViewRef = useRef<View>("menu");
  const [stepDir, setStepDir] = useState<"forward" | "back">("forward");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const categoriesMobile = ["Sve", ...Array.from(new Set(menu.map((item) => item.category)))];
  const categoryList = Array.from(new Set(menu.map((item) => item.category)));
  const visibleMobile = menu.filter((item) => item.available && (category === "Sve" || item.category === category));
  const searchTerm = search.trim().toLowerCase();
  const matchesSearch = (item: MenuItem) => !searchTerm || item.name.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm);
  const sections = categoryList.map((cat) => ({ category: cat, items: menu.filter((item) => item.available && item.category === cat && matchesSearch(item)) }));
  const hasResults = sections.some((section) => section.items.length > 0);
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
  // Iz mobilnog toka (bottom sheet) "cart" korak je već pushan preko plutajuće trake, pa ovdje
  // pushamo samo "checkout". Iz desktop bočnog panela nema prethodnog "cart" koraka pa moramo
  // pushati oba, inače back-navigacija (viewDepth.checkout = 2) preskoči previše koraka unatrag.
  const goToCheckout = () => { setStepDir("forward"); setCheckout(true); setShowCart(true); pushView("checkout"); };
  const goToCheckoutFromPanel = () => { setStepDir("forward"); setCheckout(true); setShowCart(true); pushView("cart"); pushView("checkout"); };
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
  const scrollToCategory = (cat: string) => sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Otvoreno/zatvoreno se računa iz lokalnog vremena preglednika — izračunato tek nakon
  // mounta da izbjegnemo hydration mismatch (server i klijent mogu imati različito vrijeme).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vrijednost namjerno ne postoji do mounta (server/klijent imaju različito vrijeme)
    setOpenNow(isOpenNow());
    const id = setInterval(() => setOpenNow(isOpenNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scrollspy: prati koja je sekcija jelovnika trenutno na vrhu viewporta i ističe
  // odgovarajuću kategoriju u lijevoj traci / chipovima.
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.getAttribute("data-category") ?? ""); });
    }, { rootMargin: "-120px 0px -65% 0px", threshold: 0 });
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [search]);

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
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${active ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--foreground)] shadow-sm"}`}><option.Icon className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight">{option.label}</span>
        <span className="block text-xs text-[var(--muted)]">{option.sub}</span>
      </span>
    </button>;
  })}</div>;
  const deliveryNote = isDelivery ? <div className={`mt-2 rounded-xl p-3 text-sm font-bold ${deliveryBelowMin ? "bg-red-50 text-red-700" : "bg-[#eef7ed] text-green-700"}`}>{deliveryBelowMin ? `Dodaj još ${money(deliveryRemaining)} do minimalnog iznosa za dostavu (${money(minDelivery)}).` : `Minimalni iznos za dostavu (${money(minDelivery)}) je ispunjen ✓`}</div> : null;

  const heroChips = <div className="mt-4 flex flex-wrap items-center gap-1.5">
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-md ${(openNow ?? true) ? "bg-green-500/25 text-green-50" : "bg-white/15 text-white/75"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${(openNow ?? true) ? "bg-green-400" : "bg-white/50"}`} />
      {(openNow ?? true) ? `Otvoreno do ${shop.hoursEnd}` : `Zatvoreno · otvara u ${shop.hoursStart}`}
    </span>
    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md"><Clock className="h-3.5 w-3.5" /> Gotovo za {shop.prepTime}</span>
    <span className="hidden items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md sm:inline-flex"><Wallet className="h-3.5 w-3.5" /> Plaćanje pri preuzimanju</span>
    <span className="hidden items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" /> Bez registracije</span>
  </div>;

  const cartPanelBody = cart.length === 0
    ? <div className="flex flex-col items-center gap-2 py-10 text-center">
        <ShoppingBag className="h-8 w-8 text-[var(--muted)]" />
        <p className="text-sm text-[var(--muted)]">Košarica je prazna — dodaj nešto s jelovnika.</p>
      </div>
    : <>
        <div className="mt-4">{orderTypeSelector}{deliveryNote}</div>
        <div className="mt-4 divide-y divide-black/[0.06]">{cart.map((item) => <CartRow key={item.id} item={item} onQty={changeQuantity} />)}</div>
        <div className="mt-4 border-t border-black/10 pt-4">
          {isDelivery && <div className="mb-1.5 flex justify-between text-sm text-[var(--muted)]"><span>Dostava</span><span className="font-semibold text-green-700">Besplatno</span></div>}
          <div className="flex items-baseline justify-between"><span className="text-base font-bold">Ukupno</span><span className="text-xl font-extrabold">{money(total)}</span></div>
        </div>
        <button onClick={goToCheckoutFromPanel} disabled={deliveryBelowMin} className={`mt-4 w-full rounded-xl py-3.5 font-bold text-white transition ${deliveryBelowMin ? "cursor-not-allowed bg-black/20" : "bg-[var(--brand)] hover:bg-[var(--brand-dark)] active:scale-[0.98]"}`}>{deliveryBelowMin ? `Nedostaje ${money(deliveryRemaining)} za dostavu` : `Nastavi na narudžbu · ${money(total)}`}</button>
        <p className="mt-2.5 text-center text-[11px] text-[var(--muted)]">Plaćaš pri preuzimanju · Radnja potvrđuje narudžbu</p>
      </>;

  return <main className="min-h-screen bg-[var(--background)] pb-28 md:pb-0">
    <header className="relative h-[220px] overflow-hidden lg:h-[300px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/double-burger.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25" />
      <div className="relative mx-auto flex h-full max-w-[1240px] flex-col justify-end px-5 pb-6 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-white/70 bg-white/15 text-3xl shadow-lg backdrop-blur-md lg:h-16 lg:w-16">{shop.logo}</div>
          <div className="min-w-0 text-white">
            <h1 className="font-display truncate text-2xl leading-tight sm:text-3xl lg:text-4xl">{shop.name}</h1>
            <p className="mt-1 truncate text-[13px] font-medium text-white/80 sm:text-sm">{shop.tagline} · {shop.address}</p>
          </div>
        </div>
        {heroChips}
      </div>
    </header>

    <div className="mx-auto max-w-[1240px] px-5 py-5 sm:px-8 md:grid md:grid-cols-[1fr_320px] md:gap-6 md:px-8 md:py-6 lg:grid-cols-[190px_1fr_320px] lg:gap-6 lg:px-10 lg:py-8">
      {/* Lijeva traka s kategorijama — samo laptop (≥1024px) */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-4">
          <nav className="space-y-1">
            {categoryList.map((cat) => {
              const count = menu.filter((item) => item.available && item.category === cat).length;
              const active = activeSection === cat;
              return <button key={cat} onClick={() => scrollToCategory(cat)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? "bg-[var(--brand)] text-white shadow-sm" : "text-[var(--foreground)] hover:bg-black/[0.04]"}`}>
                <span className="truncate">{cat}</span>
                <span className={`ml-2 shrink-0 text-xs font-bold ${active ? "text-white/80" : "text-[var(--muted)]"}`}>{count}</span>
              </button>;
            })}
          </nav>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4 text-sm card-shadow">
            <p className="flex items-start gap-2 font-semibold"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" /> {shop.hours}</p>
            <p className="mt-2 flex items-start gap-2 text-[var(--muted)]"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" /> {shop.address}</p>
          </div>
        </div>
      </aside>

      {/* Sredina: jelovnik */}
      <div className="min-w-0">
        {/* Tablet + laptop: pretraga i sekcije po kategorijama */}
        <div className="hidden md:block">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pretraži jelovnik…" className="w-full rounded-2xl border border-[var(--border)] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15" />
          </div>
          <div className="no-scrollbar sticky top-0 z-10 -mx-5 mb-5 overflow-x-auto bg-[var(--background)]/95 px-5 py-2.5 backdrop-blur lg:hidden">
            <div className="flex gap-2">{categoryList.map((cat) => <button key={cat} onClick={() => scrollToCategory(cat)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${activeSection === cat ? "bg-[var(--brand)] text-white" : "bg-black/[0.04] text-[var(--muted)] hover:bg-black/[0.08]"}`}>{cat}</button>)}</div>
          </div>
          <div className="space-y-8">
            {sections.map(({ category: cat, items }) => items.length === 0 ? null : (
              <section key={cat} ref={(el) => { sectionRefs.current[cat] = el; }} data-category={cat} className="section-anchor">
                <h2 className="font-display text-xl">{cat}</h2>
                <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                  {items.map((item) => <MenuItemCard key={item.id} item={item} onAdd={() => openCustomization(item)} />)}
                </div>
              </section>
            ))}
            {!hasResults && <p className="py-12 text-center text-sm text-[var(--muted)]">Nema rezultata za &quot;{search}&quot;.</p>}
          </div>
        </div>

        {/* Mobitel: filter po kategorijama (postojeći tok) */}
        <div className="md:hidden">
          <section className="no-scrollbar sticky top-0 z-10 -mx-5 overflow-x-auto bg-[var(--background)]/90 px-5 py-3 backdrop-blur">
            <div className="flex gap-2">{categoriesMobile.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${category === item ? "bg-[var(--brand)] text-white shadow-sm shadow-[var(--brand)]/30" : "bg-black/[0.04] text-[var(--muted)] hover:bg-black/[0.08]"}`}>{item}</button>)}</div>
          </section>
          <section className="grid gap-3.5 py-5">
            {visibleMobile.map((item) => <MenuItemCard key={item.id} item={item} onAdd={() => openCustomization(item)} />)}
          </section>
        </div>
      </div>

      {/* Desno: košarica — uvijek vidljiva od tableta naviše */}
      <aside className="hidden md:block">
        <div className="sticky top-6 rounded-2xl border border-[var(--border)] bg-white p-5 card-shadow">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Tvoja narudžba</h2>
            {totalItems > 0 && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs font-bold text-[var(--muted)]">{totalItems}</span>}
          </div>
          {cartPanelBody}
        </div>
      </aside>
    </div>

    <footer className="mx-auto max-w-[1240px] px-5 pb-10 pt-2 text-center text-xs text-[var(--muted)] sm:px-8 lg:px-10">
      Naručivanje pokreće <span className="font-semibold text-[var(--foreground)]">VPSolutions</span>
    </footer>

    {totalItems > 0 && !showCart && !selectedItem && <button onClick={() => { setShowCart(true); pushView("cart"); }} className="fixed bottom-5 left-1/2 z-20 flex w-[calc(100%-2.5rem)] max-w-[26rem] -translate-x-1/2 items-center justify-between rounded-2xl bg-[var(--brand)] px-5 py-4 font-bold text-white shadow-xl shadow-[var(--brand)]/30 safe-bottom active:scale-[0.98] md:hidden">
      <span>{totalItems} {totalItems === 1 ? "stavka" : "stavke"}</span>
      <span>Nastavi na narudžbu · {money(subtotal)}</span>
    </button>}

    {selectedItem && <div className="anim-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => window.history.back()}>
      <div onClick={(event) => event.stopPropagation()} className="anim-sheet flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[var(--background)] sm:max-w-[560px] sm:rounded-3xl sm:shadow-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative">
            {selectedItem.image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={selectedItem.image} alt={selectedItem.name} className="h-40 w-full object-cover sm:h-56" />
              : <div className="img-fallback h-40 w-full sm:h-56" />}
            <button onClick={() => window.history.back()} aria-label="Zatvori" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--foreground)] shadow-md backdrop-blur"><X className="h-[18px] w-[18px]" /></button>
          </div>

          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand)]">Prilagodi narudžbu</p>
            <h2 className="font-display text-2xl leading-tight">{selectedItem.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{selectedItem.description}</p>

            {selectedItem.sizes && <section className="mt-5">
              <h3 className="font-display text-base">Veličina</h3>
              <div className="mt-2 overflow-hidden rounded-2xl bg-white card-shadow">{selectedItem.sizes.map((size, index) => <button key={size.label} onClick={() => setSelectedSize(size.label)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                <span className="text-sm font-semibold">{size.label}</span>
                <span className="flex items-center gap-3"><span className="text-xs text-[var(--muted)]">{signedMoney(size.delta)}</span><Radio active={selectedSize === size.label} /></span>
              </button>)}</div>
            </section>}

            {selectedItem.sauceOptions && selectedItem.sauceOptions.length > 0 && <section className="mt-5">
              <h3 className="font-display text-base">Odaberi umak <span className="ml-1 text-xs font-normal text-[var(--muted)]">(odaberi 1, po želji)</span></h3>
              <div className="mt-2 overflow-hidden rounded-2xl bg-white card-shadow">{selectedItem.sauceOptions.map((sauce, index) => <button key={sauce} onClick={() => setSelectedSauce(selectedSauce === sauce ? null : sauce)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                <span className="text-sm font-semibold">{sauce}</span>
                <Radio active={selectedSauce === sauce} />
              </button>)}</div>
            </section>}

            {selectedItem.sideOptions && selectedItem.sideOptions.length > 0 && <section className="mt-5">
              <h3 className="font-display text-base">Prilog <span className="ml-1 text-xs font-normal text-[var(--muted)]">(odaberi 1, po želji)</span></h3>
              <div className="mt-2 overflow-hidden rounded-2xl bg-white card-shadow">{selectedItem.sideOptions.map((side, index) => <button key={side} onClick={() => setSelectedSide(selectedSide === side ? null : side)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${index > 0 ? "border-t border-black/[0.06]" : ""}`}>
                <span className="text-sm font-semibold">{side}</span>
                <Radio active={selectedSide === side} />
              </button>)}</div>
            </section>}

            {selectedItem.extraOptions && selectedItem.extraOptions.length > 0 && <section className="mt-5">
              <h3 className="font-display text-base">Dodaci <span className="ml-1 text-xs font-normal text-[var(--muted)]">(odaberi više)</span></h3>
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
            <button onClick={() => setConfigQty((q) => Math.max(1, q - 1))} aria-label="Smanji količinu" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm active:scale-90"><Minus className="h-4 w-4" /></button>
            <span className="w-7 text-center font-bold">{configQty}</span>
            <button onClick={() => setConfigQty((q) => q + 1)} aria-label="Povećaj količinu" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm active:scale-90"><Plus className="h-4 w-4" /></button>
          </div>
          <button onClick={addConfigured} className="flex flex-1 items-center justify-center rounded-full bg-[var(--brand)] py-3.5 font-bold text-white shadow-lg shadow-[var(--brand)]/30 transition hover:bg-[var(--brand-dark)] active:scale-[0.98]">Dodaj u košaricu · {money(unitConfigured * configQty)}</button>
        </div>
      </div>
    </div>}

    {showCart && <div className="anim-backdrop fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={closeSheet}>
      <div onClick={(event) => event.stopPropagation()} className="anim-sheet max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--background)] p-5 safe-bottom sm:rounded-3xl sm:shadow-2xl">
        {confirmed ? <div key="confirmed" className="anim-step-right py-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-9 w-9" /></div>
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
            <button onClick={closeSheet} className="text-[var(--muted)]" aria-label="Zatvori"><X className="h-6 w-6" /></button>
          </div>
          {!checkout ? <>
            {cart.length === 0 ? <div className="flex flex-col items-center gap-2 py-10 text-center"><ShoppingBag className="h-8 w-8 text-[var(--muted)]" /><p className="text-sm text-[var(--muted)]">Košarica je prazna — dodaj nešto s jelovnika.</p></div> : <>
              <div className="mb-4">{orderTypeSelector}{deliveryNote}</div>
              <div className="overflow-hidden rounded-2xl bg-white px-3.5 card-shadow">{cart.map((item) => <CartRow key={item.id} item={item} onQty={changeQuantity} />)}</div>
              <div className="mt-5 border-t border-black/10 pt-4">
                {isDelivery && <div className="mb-1.5 flex justify-between text-sm text-[var(--muted)]"><span>Dostava</span><span className="font-semibold text-green-700">Besplatno</span></div>}
                <div className="flex items-baseline justify-between"><span className="text-lg font-bold">Ukupno</span><span className="text-2xl font-extrabold">{money(total)}</span></div>
              </div>
              <button onClick={goToCheckout} disabled={deliveryBelowMin} className={`mt-4 w-full rounded-xl py-4 font-bold text-white transition ${deliveryBelowMin ? "cursor-not-allowed bg-black/20" : "bg-[var(--brand)] active:scale-[0.98]"}`}>{deliveryBelowMin ? `Nedostaje ${money(deliveryRemaining)} za dostavu` : "Nastavi na podatke"}</button>
            </>}
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
                <option.Icon className="h-[18px] w-[18px]" />{option.label}
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

function Radio({ active }: { active: boolean }) {
  return <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${active ? "border-[var(--brand)]" : "border-black/20"}`}>{active && <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />}</span>;
}

function Checkbox({ active }: { active: boolean }) {
  return <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${active ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-black/20"}`}>{active && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>;
}

function ItemImage({ item, className = "" }: { item: MenuItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (item.image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.image} alt={item.name} loading="lazy" onError={() => setFailed(true)} className={`shrink-0 self-stretch object-cover ${className}`} />
    );
  }
  return <div className={`img-fallback shrink-0 self-stretch ${className}`} />;
}

function MenuItemCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return <article className="relative flex overflow-hidden rounded-2xl border border-[var(--border)] bg-white card-shadow transition duration-200 hover:-translate-y-0.5 hover:card-shadow-lg">
    {item.bestseller && <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"><Flame className="h-3 w-3" /> Najprodavanije</span>}
    <div className="flex min-w-0 flex-1 flex-col p-3.5">
      <h3 className={`font-display text-base leading-tight ${item.bestseller ? "mt-5" : ""}`}>{item.name}</h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--muted)]">{item.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <strong className="text-lg font-extrabold text-[var(--brand)]">{item.sizes ? `od ${money(item.price)}` : money(item.price)}</strong>
        <button onClick={onAdd} aria-label={`Dodaj ${item.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm shadow-[var(--brand)]/40 transition hover:bg-[var(--brand-dark)] active:scale-90"><Plus className="h-5 w-5" /></button>
      </div>
    </div>
    <ItemImage item={item} className="w-[120px]" />
  </article>;
}

function CartRow({ item, onQty }: { item: CartItem; onQty: (id: string, amount: number) => void }) {
  const details = [...item.sauces, ...item.sides, ...item.extras].join(", ") || (foodCategories.includes(item.category) ? "Bez dodataka" : "");
  return <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold leading-tight">{item.name}{item.size ? <span className="font-normal text-[var(--muted)]"> · {item.size}</span> : ""}</p>
      {details && <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{details}</p>}
    </div>
    <span className="shrink-0 text-sm font-bold tabular-nums">{money(item.unitPrice * item.quantity)}</span>
    <div className="flex shrink-0 items-center gap-1.5">
      <button onClick={() => onQty(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] transition active:scale-90" aria-label="Smanji količinu"><Minus className="h-3.5 w-3.5" /></button>
      <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
      <button onClick={() => onQty(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] transition active:scale-90" aria-label="Povećaj količinu"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  </div>;
}
