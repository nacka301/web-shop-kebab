export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  emoji: string;
};

export const shop = {
  slug: "kebab-mambo",
  name: "Kebab Mambo",
  address: "Ulica Republike 12, Osijek",
  hours: "Danas otvoreno · 10:00 – 23:00",
};

export const menu: MenuItem[] = [
  { id: "small-kebab", name: "Mali kebab", description: "Piletina, salata, luk i umak u domaćem somunu", price: 5.5, category: "Kebab", available: true, emoji: "🥙" },
  { id: "large-kebab", name: "Veliki kebab", description: "Veća porcija mesa, salata, luk i umak u somunu", price: 7, category: "Kebab", available: true, emoji: "🌯" },
  { id: "salad-kebab", name: "Salata kebab", description: "Kebab meso, svježa salata i umak po izboru", price: 7, category: "Kebab", available: true, emoji: "🥗" },
  { id: "hot-dog", name: "Hot dog", description: "Hrenovka u pecivu s umakom po izboru", price: 4.5, category: "Ostalo", available: true, emoji: "🌭" },
  { id: "box", name: "Kebab box", description: "Meso, pomfrit, salata i umak u praktičnoj kutiji", price: 7.5, category: "Kebab", available: true, emoji: "🍟" },
  { id: "fries", name: "Pomfrit", description: "Hrskavi zlatni pomfrit", price: 2.5, category: "Prilozi", available: true, emoji: "🍟" },
  { id: "cola", name: "Coca-Cola 0.5 l", description: "Ohlađena Coca-Cola", price: 2, category: "Piće", available: true, emoji: "🥤" },
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
  { id: "#1048", customer: "Marko Horvat", phone: "091 234 5678", items: "1× Mambo special, 1× Coca-Cola", total: 10.5, pickup: "Što prije", note: "Bez luka, molim", status: "nova", createdAt: "upravo sada" },
  { id: "#1047", customer: "Ana Kovač", phone: "098 111 2233", items: "2× Classic kebab", total: 13, pickup: "Za 30 min", note: "", status: "u_pripremi", createdAt: "prije 4 min" },
  { id: "#1046", customer: "Ivan Babić", phone: "095 444 5566", items: "1× Kebab box, 1× Pomfrit", total: 10, pickup: "Za 45 min", note: "", status: "spremna", createdAt: "prije 12 min" },
];
