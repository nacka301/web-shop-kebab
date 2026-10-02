export type SelectionType = "single" | "multiple";
export type OrderType = "preuzimanje" | "dostava";
export type OrderStatus = "na_cekanju" | "prihvacena" | "spremna" | "odbijena";

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

// Radno vrijeme jednog dana. `zatvara` manji ili jednak `otvara` znači zatvaranje poslije
// ponoći (npr. 09:00–02:00 => zatvara se u 02:00 sljedećeg dana). `null` = neradni dan.
export type DayHours = { otvara: string; zatvara: string } | null;

// Indeks odgovara Date#getDay(): 0 = nedjelja, 1 = ponedjeljak, … 6 = subota.
export type WeekHours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

export type ShopDTO = {
  id: string;
  slug: string;
  naziv: string;
  opis: string;
  adresa: string;
  logo: string;
  telefon: string | null;
  // Redci radnog vremena za prikaz, npr. ["Pon–Čet 09–23", "Pet–Sub 09–02", "Ned 16–22"].
  radnoVrijemeRedovi: string[];
  tjedno: WeekHours;
  // Oznaka vremena pripreme za preuzimanje, npr. "10–15 min".
  vrijemePripreme: string;
  heroSlika: string | null;
  minIznosDostave: number;
  acceptingOrders: boolean;
};

export type CartLineOption = { groupId: string; optionId: string };

export type CartLineInput = {
  menuItemId: string;
  quantity: number;
  selectedOptions: CartLineOption[];
};

export type SubmitOrderInput = {
  shopId: string;
  vrsta: OrderType;
  adresaDostave: string | null;
  ime: string;
  telefon: string;
  napomena: string;
  odmah: boolean;
  scheduledTime: string | null; // "HH:MM" when !odmah
  cart: CartLineInput[];
};

export type SubmitOrderResult =
  | { ok: true; publicToken: string }
  | { ok: false; error: string };

export type OrderItemDTO = {
  nazivArtikla: string;
  kolicina: number;
  jedinicnaCijena: number;
  cijenaUkupno: number;
  odabraneOpcije: { grupa: string; opcija: string; doplata: number }[];
};

export type OrderStatusDTO = {
  id: string;
  status: OrderStatus;
  vrsta: OrderType;
  adresaDostave: string | null;
  imeKupca: string;
  trazenoVrijeme: string;
  odmah: boolean;
  spremnoU: string | null;
  napomena: string;
  ukupnaCijena: number;
  createdAt: string;
  shop: { naziv: string; telefon: string | null; slug: string; vrijemePripreme: string };
  stavke: OrderItemDTO[];
};
