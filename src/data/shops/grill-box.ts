import type { MenuItemDTO, OptionGroupDTO, ShopDTO } from "@/lib/types";

// Postojeći demo (SMASH, Vinkovci) — podaci i jelovnik preneseni 1:1 iz ranijeg
// `src/data/demo.ts`, bez izmjena. Registriran je i na /grill-box i na /smash jer su
// obje rute oduvijek prikazivale isti skup podataka.

const umaci = ["Smash umak", "Majoneza", "Kečap ljuti", "Kečap blagi", "Ajvar", "Senf"];
const prilozi = ["Zelena salata", "Rajčica", "Kiseli krastavci", "Svježi krastavci", "Kukuruz", "Luk"];
const dodaci = [
  { naziv: "Slanina", doplata: 0.5 },
  { naziv: "Sir listić", doplata: 0.5 },
  { naziv: "Sok 0,5 L", doplata: 2 },
];

function group(
  itemId: string,
  naziv: string,
  selectionType: OptionGroupDTO["selectionType"],
  options: { naziv: string; doplata: number }[]
): OptionGroupDTO {
  const groupId = `${itemId}-${naziv.toLowerCase().replace(/\s+/g, "-")}`;
  return {
    id: groupId,
    naziv,
    selectionType,
    obavezno: false,
    options: options.map((option, index) => ({
      id: `${groupId}-${index}`,
      naziv: option.naziv,
      doplata: option.doplata,
      dostupno: true,
    })),
  };
}

const umakGroup = (itemId: string) => group(itemId, "Umak", "single", umaci.map((naziv) => ({ naziv, doplata: 0 })));
const prilogGroup = (itemId: string) => group(itemId, "Prilozi", "multiple", prilozi.map((naziv) => ({ naziv, doplata: 0 })));
const dodatakGroup = (itemId: string) => group(itemId, "Dodaci", "multiple", dodaci);

export const shop: ShopDTO = {
  id: "smash",
  slug: "grill-box",
  naziv: "SMASH",
  opis: "Smash burgeri i sendviči iz Vinkovaca.",
  adresa: "Vinkovci",
  logo: "🍔",
  telefon: null,
  radnoVrijemeRedovi: ["Uto–Ned 17:00 – 23:00", "Ponedjeljkom zatvoreno"],
  tjedno: [
    { otvara: "17:00", zatvara: "23:00" }, // nedjelja
    null, // ponedjeljak — zatvoreno
    { otvara: "17:00", zatvara: "23:00" },
    { otvara: "17:00", zatvara: "23:00" },
    { otvara: "17:00", zatvara: "23:00" },
    { otvara: "17:00", zatvara: "23:00" },
    { otvara: "17:00", zatvara: "23:00" }, // subota
  ],
  vrijemePripreme: "10 – 15 min",
  heroSlika: "/images/double-burger.jpg",
  minIznosDostave: 15,
  acceptingOrders: true,
};

export const menu: MenuItemDTO[] = [
  {
    id: "smash-classic",
    naziv: "Smash Classic",
    opis: "Domaće pecivo s krumpirom, junetina x2, cheddar sir x2, kiseli krastavci, umak po izboru",
    cijena: 4,
    kategorija: "Smash burgeri",
    slika: "/images/cheeseburger.jpg",
    dostupno: true,
    bestseller: true,
    optionGroups: [umakGroup("smash-classic"), dodatakGroup("smash-classic")],
  },
  {
    id: "smash-onion",
    naziv: "Smash Onion",
    opis: "Domaće pecivo s krumpirom, junetina x2, pržena na luku, cheddar sir x2, umak po izboru",
    cijena: 5,
    kategorija: "Smash burgeri",
    slika: "/images/smash-onion.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [umakGroup("smash-onion"), dodatakGroup("smash-onion")],
  },
  {
    id: "smash-chicken",
    naziv: "Smash Chicken",
    opis: "Domaće pecivo, pohana piletina, umak i salata po izboru",
    cijena: 5,
    kategorija: "Smash burgeri",
    slika: "/images/chicken-burger.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [umakGroup("smash-chicken"), prilogGroup("smash-chicken"), dodatakGroup("smash-chicken")],
  },
  {
    id: "sendvic-sunka",
    naziv: "Sendvič Šunka",
    opis: "Domaće pecivo s krumpirom, šunka, sir Gauda, umak i salata po izboru",
    cijena: 3.5,
    kategorija: "Sendviči",
    slika: "/images/tost.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [umakGroup("sendvic-sunka"), prilogGroup("sendvic-sunka"), dodatakGroup("sendvic-sunka")],
  },
  {
    id: "sendvic-kulen",
    naziv: "Sendvič Kulen",
    opis: "Domaće pecivo s krumpirom, kulen, sir Gauda, umak i salata po izboru",
    cijena: 4,
    kategorija: "Sendviči",
    slika: "/images/tost.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [umakGroup("sendvic-kulen"), prilogGroup("sendvic-kulen"), dodatakGroup("sendvic-kulen")],
  },
  {
    id: "sendvic-tuna",
    naziv: "Sendvič Tuna",
    opis: "Pecivo, tuna, salata i umak po izboru",
    cijena: 4,
    kategorija: "Sendviči",
    slika: "/images/sendvic-tuna.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [umakGroup("sendvic-tuna"), prilogGroup("sendvic-tuna"), dodatakGroup("sendvic-tuna")],
  },
  {
    id: "hot-dog",
    naziv: "Hot Dog",
    opis: "Pecivo, grill kobasica, umak po izboru",
    cijena: 2,
    kategorija: "Ostalo",
    slika: "/images/hot-dog.jpg",
    dostupno: true,
    bestseller: true,
    optionGroups: [umakGroup("hot-dog"), dodatakGroup("hot-dog")],
  },
  {
    id: "waffle-fries",
    naziv: "Waffle Fries",
    opis: "Domaći waffle fries krumpirići",
    cijena: 2.5,
    kategorija: "Prilozi",
    slika: "/images/waffle-fries.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [],
  },
  {
    id: "pommes-frites",
    naziv: "Pommes Frites",
    opis: "Klasični hrskavi pomfrit",
    cijena: 2,
    kategorija: "Prilozi",
    slika: "/images/fries.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [],
  },
  {
    id: "cola",
    naziv: "Coca-Cola",
    opis: "Ohlađeno gazirano piće",
    cijena: 2,
    kategorija: "Piće",
    slika: "/images/cola.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [],
  },
  {
    id: "voda",
    naziv: "Voda 0,5 l",
    opis: "Negazirana izvorska voda",
    cijena: 1.5,
    kategorija: "Piće",
    slika: "/images/voda.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [],
  },
  {
    id: "sok",
    naziv: "Sok",
    opis: "Prirodni voćni sok",
    cijena: 2,
    kategorija: "Piće",
    slika: "/images/sok.jpg",
    dostupno: true,
    bestseller: false,
    optionGroups: [],
  },
];
