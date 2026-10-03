import { MAX_ITEMS_TOTAL, MAX_QTY_PER_LINE, MAX_TOTAL_CENTS, formatEuro } from "./limits";

// Cijene i opcije dolaze ISKLJUČIVO iz baze. Klijent šalje samo id-eve i količine.
export type PricingOption = { id: string; name: string; priceDeltaCents: number };
export type PricingGroup = {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  maxSelect: number | null;
  options: PricingOption[];
};
export type PricingItem = {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
  groups: PricingGroup[];
};

export type CartLine = { itemId: string; qty: number; optionIds: string[] };

export type PricedLine = {
  itemId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
  options: { group: string; name: string; priceDeltaCents: number }[];
};

export type PriceResult =
  | { ok: true; lines: PricedLine[]; totalCents: number; totalQty: number }
  | { ok: false; error: string };

export function priceCart(items: PricingItem[], cart: CartLine[]): PriceResult {
  const byId = new Map(items.map((item) => [item.id, item]));
  const lines: PricedLine[] = [];
  let totalCents = 0;
  let totalQty = 0;

  for (const line of cart) {
    const item = byId.get(line.itemId);
    if (!item) return { ok: false, error: "Jedan artikl iz košarice ne postoji u ovoj radnji." };
    if (!item.available) return { ok: false, error: `Artikl ${item.name} više nije dostupan.` };
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY_PER_LINE) {
      return { ok: false, error: `Količina po artiklu je od 1 do ${MAX_QTY_PER_LINE}.` };
    }
    if (new Set(line.optionIds).size !== line.optionIds.length) {
      return { ok: false, error: `Neispravne opcije za ${item.name}.` };
    }

    const chosen = new Map<string, PricingGroup>(); // optionId -> grupa
    const optionsById = new Map<string, PricingOption>();
    for (const group of item.groups) {
      for (const option of group.options) {
        chosen.set(option.id, group);
        optionsById.set(option.id, option);
      }
    }

    const perGroup = new Map<string, string[]>();
    for (const optionId of line.optionIds) {
      const group = chosen.get(optionId);
      if (!group) return { ok: false, error: `Neispravna opcija za ${item.name}.` };
      perGroup.set(group.id, [...(perGroup.get(group.id) ?? []), optionId]);
    }

    let unitPriceCents = item.priceCents;
    const options: PricedLine["options"] = [];
    for (const group of item.groups) {
      const selected = perGroup.get(group.id) ?? [];
      if (group.required && selected.length === 0) {
        return { ok: false, error: `Odaberi "${group.name}" za ${item.name}.` };
      }
      if (group.type === "single" && selected.length > 1) {
        return { ok: false, error: `Za "${group.name}" (${item.name}) može se odabrati samo jedna opcija.` };
      }
      if (group.maxSelect !== null && selected.length > group.maxSelect) {
        return { ok: false, error: `Za "${group.name}" (${item.name}) odaberi najviše ${group.maxSelect}.` };
      }
      for (const optionId of selected) {
        const option = optionsById.get(optionId)!;
        unitPriceCents += option.priceDeltaCents;
        options.push({ group: group.name, name: option.name, priceDeltaCents: option.priceDeltaCents });
      }
    }

    const lineTotalCents = unitPriceCents * line.qty;
    totalCents += lineTotalCents;
    totalQty += line.qty;
    lines.push({ itemId: item.id, name: item.name, qty: line.qty, unitPriceCents, lineTotalCents, options });
  }

  if (totalQty > MAX_ITEMS_TOTAL) {
    return { ok: false, error: `Najviše ${MAX_ITEMS_TOTAL} komada po narudžbi.` };
  }
  if (totalCents > MAX_TOTAL_CENTS) {
    return { ok: false, error: `Najveći iznos narudžbe je ${formatEuro(MAX_TOTAL_CENTS)}.` };
  }
  return { ok: true, lines, totalCents, totalQty };
}
