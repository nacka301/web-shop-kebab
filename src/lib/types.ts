export type SelectionType = "single" | "multiple";
export type OrderStatus = "new" | "accepted" | "ready" | "done" | "rejected";
export type PickupType = "asap" | "time";

export type OptionDTO = {
  id: string;
  naziv: string;
  doplata: number;
  dostupno: boolean;
};

export type OptionGroupDTO = {
  id: string;
  naziv: string;
  selectionType: SelectionType;
  obavezno: boolean;
  maxSelect: number | null;
  options: OptionDTO[];
};

export type MenuItemDTO = {
  id: string;
  naziv: string;
  opis: string;
  cijena: number;
  kategorija: string;
  slika: string | null;
  dostupno: boolean;
  bestseller: boolean;
  optionGroups: OptionGroupDTO[];
};

// Jedan radni interval unutar dana. `zatvara` manji ili jednak `otvara` znači zatvaranje
// poslije ponoći (npr. 09:00–02:00 => zatvara se u 02:00 sljedećeg dana).
export type DayWindow = { otvara: string; zatvara: string };

// Indeks odgovara Date#getDay(): 0 = nedjelja, 1 = ponedjeljak, … 6 = subota.
// Prazna lista = taj dan je radnja zatvorena. Vrijeme je uvijek po Europe/Zagreb.
export type WeekHours = DayWindow[][];

export type ShopDTO = {
  id: string;
  slug: string;
  naziv: string;
  opis: string;
  adresa: string;
  // Kratki tekstualni logo ili emoji; ako postoji logoUrl, prikazuje se slika.
  logo: string;
  logoUrl: string | null;
  accentColor: string;
  telefon: string | null;
  // Redci radnog vremena za prikaz, npr. ["Pon–Čet 09:00 – 23:00", "Ned 16:00 – 22:00"].
  radnoVrijemeRedovi: string[];
  tjedno: WeekHours;
  // Oznaka vremena pripreme za preuzimanje, npr. "15 min" ili "10 – 15 min".
  vrijemePripreme: string;
  heroSlika: string | null;
  minIznosDostave: number;
  acceptingOrders: boolean;
  // Demo radnje ne spremaju narudžbe; samo one nude dostavu (stvarne rade samo preuzimanje).
  isDemo: boolean;
};

// Narudžba za demo radnje (server action) — nikad se ne sprema u bazu.
export type DemoOrderInput = {
  slug: string;
  vrsta: "preuzimanje" | "dostava";
  adresaDostave: string | null;
  ime: string;
  telefon: string;
  napomena: string;
  odmah: boolean;
  scheduledTime: string | null; // ISO trenutak kad !odmah
  cart: { itemId: string; quantity: number; optionIds: string[] }[];
};

export type SubmitOrderResult = { ok: true; orderId: string } | { ok: false; error: string };

export type OrderItemDTO = {
  name: string;
  qty: number;
  lineTotalCents: number;
  options: string[];
};

// Namjerno minimalno: bez telefona i imena kupca — stranicu vidi svatko tko ima uuid.
export type OrderStatusDTO = {
  id: string;
  shortCode: string;
  status: OrderStatus;
  etaMinutes: number | null;
  rejectReason: string | null;
  pickupType: PickupType;
  pickupTime: string | null;
  deliveryAddress: string | null; // samo demo
  totalCents: number;
  items: OrderItemDTO[];
  restaurant: { name: string; slug: string; phone: string | null };
  isDemo: boolean;
  createdAt: string;
};
