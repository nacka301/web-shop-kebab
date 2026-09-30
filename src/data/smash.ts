export type SizeOption = { label: string; delta: number };
export type ExtraOption = { name: string; price: number };
export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  emoji: string;
  image?: string;
  sizes?: SizeOption[];
  sauceOptions?: string[];
  sideOptions?: string[];
  extraOptions?: ExtraOption[];
};

const smashSauces = ["Smash umak", "Majoneza", "Kečap ljuti", "Kečap blagi", "Ajvar", "Senf"];
const smashSides = ["Zelena salata", "Rajčica", "Kiseli krastavci", "Svježi krastavci", "Kukuruz", "Luk"];
const smashExtras: ExtraOption[] = [
  { name: "Slanina", price: 0.5 },
  { name: "Sir listić", price: 0.5 },
  { name: "Sok 0,5 L", price: 2 },
];

export const shop = {
  slug: "smash",
  name: "SMASH",
  logo: "🍔",
  tagline: "Smash burgeri i sendviči iz Vinkovaca",
  description:
    "Domaće pecivo s krumpirom, smash pljeskavice i hrskavi waffle fries — svaki dan svježe u Vinkovcima. Naruči online i preuzmi bez čekanja u redu.",
  address: "Vinkovci",
  hours: "Svaki dan 17:00 – 23:00 · ponedjeljkom zatvoreno",
  rating: "5,0",
  prepTime: "10 – 15 min",
};

export const menu: MenuItem[] = [
  { id: "smash-classic", name: "Smash Classic", description: "Domaće pecivo s krumpirom, junetina x2, cheddar sir x2, kiseli krastavci, umak po izboru", price: 4, category: "Smash burgeri", available: true, emoji: "🍔", sauceOptions: smashSauces, extraOptions: smashExtras },
  { id: "smash-onion", name: "Smash Onion", description: "Domaće pecivo s krumpirom, junetina x2, pržena na luku, cheddar sir x2, umak po izboru", price: 5, category: "Smash burgeri", available: true, emoji: "🍔", sauceOptions: smashSauces, extraOptions: smashExtras },
  { id: "smash-chicken", name: "Smash Chicken", description: "Domaće pecivo, pohana piletina, umak i salata po izboru", price: 5, category: "Smash burgeri", available: true, emoji: "🍗", sauceOptions: smashSauces, sideOptions: smashSides, extraOptions: smashExtras },
  { id: "sendvic-sunka", name: "Sendvič Šunka", description: "Domaće pecivo s krumpirom, šunka, sir Gauda, umak i salata po izboru", price: 3.5, category: "Sendviči", available: true, emoji: "🥪", sauceOptions: smashSauces, sideOptions: smashSides, extraOptions: smashExtras },
  { id: "sendvic-kulen", name: "Sendvič Kulen", description: "Domaće pecivo s krumpirom, kulen, sir Gauda, umak i salata po izboru", price: 4, category: "Sendviči", available: true, emoji: "🥪", sauceOptions: smashSauces, sideOptions: smashSides, extraOptions: smashExtras },
  { id: "sendvic-tuna", name: "Sendvič Tuna", description: "Pecivo, tuna, salata i umak po izboru", price: 4, category: "Sendviči", available: true, emoji: "🥪", sauceOptions: smashSauces, sideOptions: smashSides, extraOptions: smashExtras },
  { id: "hot-dog", name: "Hot Dog", description: "Pecivo, grill kobasica, umak po izboru", price: 2, category: "Ostalo", available: true, emoji: "🌭", sauceOptions: smashSauces, extraOptions: smashExtras },
  { id: "waffle-fries", name: "Waffle Fries", description: "Domaći waffle fries krumpirići", price: 2.5, category: "Prilozi", available: true, emoji: "🧇" },
  { id: "pommes-frites", name: "Pommes Frites", description: "Klasični hrskavi pomfrit", price: 2, category: "Prilozi", available: true, emoji: "🍟" },
];
