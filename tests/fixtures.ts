import { parseOpeningHours } from "../src/lib/hours";
import type { PricingItem } from "../src/lib/orders/pricing";
import type { RestaurantForOrder } from "../src/lib/orders/prepare";

// Emmito: pon–čet 09–23, pet–sub 09–02 (sljedeći dan), ned 16–22.
export const emmitoHours = parseOpeningHours({
  mon: [["09:00", "23:00"]],
  tue: [["09:00", "23:00"]],
  wed: [["09:00", "23:00"]],
  thu: [["09:00", "23:00"]],
  fri: [["09:00", "02:00"]],
  sat: [["09:00", "02:00"]],
  sun: [["16:00", "22:00"]],
});

export const restaurant: RestaurantForOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "test-radnja",
  name: "Test radnja",
  isDemo: false,
  acceptingOrders: true,
  tjedno: emmitoHours,
};

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ids = { kebab: ID(1), salata: ID(2), pice: ID(3), nedostupno: ID(4), ljuti: ID(11), blagi: ID(12), sir: ID(13), luk: ID(14), kecap: ID(15) };

// Kebab 5,00 € (umak obavezan, jedan), Salata 5,00 € (dodaci: max 1), Piće 2,00 €, jedan nedostupan.
export const items: PricingItem[] = [
  {
    id: ids.kebab,
    name: "Kebab veliki",
    priceCents: 500,
    available: true,
    groups: [
      {
        id: ID(101), name: "Umak", type: "single", required: true, maxSelect: null,
        options: [
          { id: ids.ljuti, name: "Ljuti", priceDeltaCents: 0 },
          { id: ids.blagi, name: "Blagi", priceDeltaCents: 0 },
        ],
      },
      {
        id: ID(102), name: "Dodaci", type: "multi", required: false, maxSelect: 1,
        options: [
          { id: ids.sir, name: "Sir", priceDeltaCents: 100 },
          { id: ids.luk, name: "Luk", priceDeltaCents: 50 },
        ],
      },
    ],
  },
  { id: ids.salata, name: "Kebab salata", priceCents: 500, available: true, groups: [] },
  { id: ids.pice, name: "Sok", priceCents: 200, available: true, groups: [] },
  { id: ids.nedostupno, name: "Pikito sendvič", priceCents: 300, available: false, groups: [] },
];

// Zagreb ljeti je UTC+2 (CEST), zimi UTC+1 (CET). Instanti su zadani u UTC-u namjerno,
// da testovi ne ovise o zoni stroja na kojem se vrte.
export const at = (iso: string) => new Date(iso);
