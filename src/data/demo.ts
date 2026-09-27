export type SizeOption = { label: string; delta: number };
export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  emoji: string;
  sizes?: SizeOption[];
};

export const shop = {
  slug: "grill-box",
  name: "Grill Box",
  logo: "🍔",
  tagline: "Burgeri, gablec i roštilj — brzo i domaće",
  description:
    "Svježe pljeskavice s roštilja, hrskavi pomfrit i domaći gablec svaki dan. Naruči online i preuzmi bez čekanja u redu.",
  address: "Ulica Republike 12, Osijek",
  hours: "Danas otvoreno · 09:00 – 23:00",
  rating: "4,8",
  prepTime: "15 – 20 min",
};

export const menu: MenuItem[] = [
  { id: "cheeseburger", name: "Cheeseburger", description: "Sočna pljeskavica, cheddar, salata i umak u pecivu", price: 4.5, category: "Burgeri", available: true, emoji: "🍔" },
  { id: "double-burger", name: "Dvostruki burger", description: "Dvije pljeskavice, dupli cheddar i hrskava slanina", price: 6.5, category: "Burgeri", available: true, emoji: "🍔" },
  { id: "chicken-burger", name: "Piletina burger", description: "Hrskava piletina, salata i umak po izboru", price: 5, category: "Burgeri", available: true, emoji: "🍔" },
  { id: "gablec", name: "Gablec dana", description: "Pljeskavica, pomfrit i salata — domaći gablec", price: 6, category: "Gablec", available: true, emoji: "🍽️", sizes: [{ label: "Normalni", delta: 0 }, { label: "Veliki", delta: 1.5 }] },
  { id: "cevapi", name: "Ćevapi u lepinji", description: "10 ćevapa, lepinja, ajvar i luk", price: 5.5, category: "Gablec", available: true, emoji: "🥙" },
  { id: "fries", name: "Pomfrit", description: "Hrskavi zlatni pomfrit", price: 2.5, category: "Prilozi", available: true, emoji: "🍟", sizes: [{ label: "Mala", delta: 0 }, { label: "Velika", delta: 1.5 }] },
  { id: "onion-rings", name: "Prženi luk", description: "Hrskavi pohani kolutovi luka", price: 3, category: "Prilozi", available: true, emoji: "🧅" },
  { id: "tost", name: "Tost", description: "Šunka, sir i maslac u prepečenom kruhu", price: 3, category: "Ostalo", available: true, emoji: "🥪" },
  { id: "hot-dog", name: "Hot dog", description: "Hrenovka u pecivu s umakom po izboru", price: 3.5, category: "Ostalo", available: true, emoji: "🌭" },
  { id: "cola", name: "Coca-Cola", description: "Ohlađeno gazirano piće", price: 2, category: "Piće", available: true, emoji: "🥤", sizes: [{ label: "0,5 l boca", delta: 0 }, { label: "0,33 l limenka", delta: -0.3 }] },
  { id: "voda", name: "Voda 0,5 l", description: "Negazirana izvorska voda", price: 1.5, category: "Piće", available: true, emoji: "💧" },
];

export type OrderStatus = "nova" | "u_pripremi" | "spremna" | "preuzeta";
export type Order = {
  id: string;
  customer: string;
  phone: string;
  items: string;
  total: number;
  pickup: string;
  note: string;
  status: OrderStatus;
  createdAt: string;
};

export const demoOrders: Order[] = [
  { id: "#1048", customer: "Marko Horvat", phone: "091 234 5678", items: "1× Dvostruki burger, 1× Coca-Cola", total: 8.5, pickup: "Što prije", note: "Bez luka, molim", status: "nova", createdAt: "upravo sada" },
  { id: "#1047", customer: "Ana Kovač", phone: "098 111 2233", items: "2× Cheeseburger", total: 9, pickup: "Za 30 min", note: "", status: "u_pripremi", createdAt: "prije 4 min" },
  { id: "#1046", customer: "Ivan Babić", phone: "095 444 5566", items: "1× Gablec dana, 1× Pomfrit", total: 8.5, pickup: "Za 45 min", note: "", status: "spremna", createdAt: "prije 12 min" },
];
