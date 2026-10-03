import { MAX_AHEAD_HOURS, isWithinWorkingHours } from "@/lib/hours";
import type { WeekHours } from "@/lib/types";
import { normalizeSource, type Source } from "@/lib/sources";
import { normalizeCroatianPhone } from "@/lib/validation";
import type { OrderRequest } from "./schema";
import { priceCart, type PricedLine, type PricingItem } from "./pricing";

export type RestaurantForOrder = {
  id: string;
  slug: string;
  name: string;
  isDemo: boolean;
  acceptingOrders: boolean;
  tjedno: WeekHours;
};

export type PreparedOrder = {
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  pickupType: "asap" | "time";
  pickupTime: Date | null;
  note: string;
  source: Source | null;
  totalCents: number;
  lines: PricedLine[];
};

export type PrepareResult = { ok: true; order: PreparedOrder } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): PrepareResult => ({ ok: false, status, error });

// Sve provjere koje ne trebaju bazu osim čitanja radnje i jelovnika. Cijene dolaze iz `items`
// (učitano iz baze), nikad iz zahtjeva.
export function prepareOrder(args: {
  request: OrderRequest;
  restaurant: RestaurantForOrder;
  items: PricingItem[];
  now: Date;
  allowDemo?: boolean;
}): PrepareResult {
  const { request, restaurant, items, now } = args;

  if (restaurant.isDemo && !args.allowDemo) {
    return fail(403, "Ovo je demo radnja — narudžbe se ne primaju.");
  }
  if (!restaurant.acceptingOrders) return fail(409, "Radnja trenutno ne prima narudžbe.");

  const phone = normalizeCroatianPhone(request.phone);
  if (!phone) return fail(400, "Unesi ispravan broj mobitela.");

  let pickupTime: Date | null = null;
  if (request.pickup_type === "asap") {
    // "Što prije" ima smisla samo dok je radnja otvorena.
    if (!isWithinWorkingHours(restaurant, now)) return fail(409, "Radnja je trenutno zatvorena.");
  } else {
    if (!request.pickup_time) return fail(400, "Odaberi vrijeme preuzimanja.");
    pickupTime = new Date(request.pickup_time);
    if (Number.isNaN(pickupTime.getTime()) || pickupTime.getTime() <= now.getTime()) {
      return fail(400, "Vrijeme preuzimanja mora biti u budućnosti.");
    }
    if (pickupTime.getTime() > now.getTime() + MAX_AHEAD_HOURS * 3_600_000) {
      return fail(400, `Preuzimanje se može zakazati najviše ${MAX_AHEAD_HOURS} sata unaprijed.`);
    }
    if (!isWithinWorkingHours(restaurant, pickupTime)) {
      return fail(400, "Odabrano vrijeme je izvan radnog vremena.");
    }
  }

  const priced = priceCart(
    items,
    request.items.map((line) => ({ itemId: line.item_id, qty: line.qty, optionIds: line.option_ids }))
  );
  if (!priced.ok) return fail(400, priced.error);

  return {
    ok: true,
    order: {
      restaurantId: restaurant.id,
      customerName: request.name,
      customerPhone: phone,
      pickupType: request.pickup_type,
      pickupTime,
      note: request.note,
      source: normalizeSource(request.src),
      totalCents: priced.totalCents,
      lines: priced.lines,
    },
  };
}
