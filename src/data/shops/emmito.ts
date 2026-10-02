import type { MenuItemDTO, OptionGroupDTO, ShopDTO } from "@/lib/types";

// Emmito — kebab i brza hrana, Daruvar. Podaci s cjenika na objektu.
// Jedina grupa opcija je umak (bez doplate); dodataka s doplatom nema.

function umak(itemId: string, obavezno: boolean): OptionGroupDTO {
  const groupId = `${itemId}-umak`;
  return {
    id: groupId,
    naziv: "Umak",
    selectionType: "single",
    obavezno,
    options: [
      { id: `${groupId}-ljuti`, naziv: "Ljuti", doplata: 0, dostupno: true },
      { id: `${groupId}-blagi`, naziv: "Blagi", doplata: 0, dostupno: true },
    ],
  };
}

export const shop: ShopDTO = {
  id: "emmito",
  slug: "emmito",
  naziv: "Emmito",
  opis: "Kebab i brza hrana u centru Daruvara.",
  adresa: "Josipa Jelačića 3, 43500 Daruvar",
  logo: "EMMITO",
  telefon: null,
  radnoVrijemeRedovi: ["Pon–Čet 09:00 – 23:00", "Pet–Sub 09:00 – 02:00", "Ned 16:00 – 22:00"],
  // Petak i subota se zatvaraju u 02:00 sljedećeg dana (zatvara <= otvara).
  tjedno: [
    { otvara: "16:00", zatvara: "22:00" }, // nedjelja
    { otvara: "09:00", zatvara: "23:00" }, // ponedjeljak
    { otvara: "09:00", zatvara: "23:00" }, // utorak
    { otvara: "09:00", zatvara: "23:00" }, // srijeda
    { otvara: "09:00", zatvara: "23:00" }, // četvrtak
    { otvara: "09:00", zatvara: "02:00" }, // petak
    { otvara: "09:00", zatvara: "02:00" }, // subota
  ],
  vrijemePripreme: "10 – 15 min",
  heroSlika: null,
  minIznosDostave: 15,
  acceptingOrders: true,
};

export const menu: MenuItemDTO[] = [
  {
    id: "kebab-extra-veliki",
    naziv: "Kebab extra veliki",
    opis: "Meso, salata, umak i pecivo",
    cijena: 6.5,
    kategorija: "Kebabi",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("kebab-extra-veliki", true)],
  },
  {
    id: "kebab-veliki",
    naziv: "Kebab veliki",
    opis: "Meso, salata, umak i pecivo",
    cijena: 5,
    kategorija: "Kebabi",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("kebab-veliki", true)],
  },
  {
    id: "kebab-mali",
    naziv: "Kebab mali",
    opis: "Meso, salata, umak i pecivo",
    cijena: 4,
    kategorija: "Kebabi",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("kebab-mali", true)],
  },
  {
    id: "kebab-u-tortilji",
    naziv: "Kebab u tortilji",
    opis: "Meso, salata i umak u tortilji",
    cijena: 5.5,
    kategorija: "Kebabi",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("kebab-u-tortilji", true)],
  },
  {
    id: "kebab-salata",
    naziv: "Kebab salata",
    opis: "Meso, salata i umak",
    cijena: 5,
    kategorija: "Kebabi",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("kebab-salata", false)],
  },
  {
    id: "pikito-sendvic",
    naziv: "Pikito sendvič",
    opis: "Salata i umak",
    cijena: 3,
    kategorija: "Sendviči",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("pikito-sendvic", true)],
  },
  {
    id: "vege-u-tortilji",
    naziv: "Vege u tortilji",
    opis: "Povrće, sir i umak u tortilji",
    cijena: 4,
    kategorija: "Vege",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("vege-u-tortilji", true)],
  },
  {
    id: "vege-sendvic",
    naziv: "Vege sendvič",
    opis: "Povrće, sir i umak",
    cijena: 2,
    kategorija: "Vege",
    slika: null,
    dostupno: true,
    bestseller: false,
    optionGroups: [umak("vege-sendvic", false)],
  },
];
