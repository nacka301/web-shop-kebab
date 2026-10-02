"use server";

import { z } from "zod";
import { getShopData } from "@/data/shops";
import { saveOrder } from "@/lib/data/order-store";
import { isValidCroatianPhone, isValidName } from "@/lib/validation";
import { isWithinWorkingHours, resolveSlot } from "@/lib/hours";
import type { OrderItemDTO, SubmitOrderInput, SubmitOrderResult } from "@/lib/types";

const cartLineSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  selectedOptions: z.array(z.object({ groupId: z.string().min(1), optionId: z.string().min(1) })),
});

const submitOrderSchema = z.object({
  shopId: z.string().min(1),
  vrsta: z.enum(["preuzimanje", "dostava"]),
  adresaDostave: z.string().trim().min(1).nullable(),
  ime: z.string().max(200),
  telefon: z.string().max(50),
  napomena: z.string().max(500),
  odmah: z.boolean(),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  cart: z.array(cartLineSchema).min(1).max(50),
});

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const parsed = submitOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci narudžbe." };
  const data = parsed.data;

  if (!isValidName(data.ime)) return { ok: false, error: "Unesi ime i prezime." };
  if (!isValidCroatianPhone(data.telefon)) return { ok: false, error: "Unesi ispravan broj mobitela." };
  if (data.vrsta === "dostava" && !data.adresaDostave) return { ok: false, error: "Unesi adresu dostave." };
  if (!data.odmah && !data.scheduledTime) return { ok: false, error: "Odaberi vrijeme preuzimanja." };

  const shopData = getShopData(data.shopId);
  if (!shopData) return { ok: false, error: "Radnja nije pronađena." };
  const { shop, menu } = shopData;
  if (!shop.acceptingOrders) return { ok: false, error: "Radnja trenutno ne prima narudžbe." };

  const now = new Date();
  // Zakazani termin se razrješava kroz istu listu termina koju nudi checkout, pa je
  // svako vrijeme izvan radnog vremena (uključujući dvoznačne sate poslije ponoći)
  // odbijeno već time što ga nema među ponuđenim terminima.
  const trazenoVrijeme = data.odmah ? now : resolveSlot(shop, data.scheduledTime!, now);
  if (!trazenoVrijeme) return { ok: false, error: "Odabrano vrijeme je izvan radnog vremena." };
  if (data.odmah && !isWithinWorkingHours(shop, now)) {
    return { ok: false, error: "Radnja je trenutno zatvorena." };
  }

  const menuById = new Map(menu.map((item) => [item.id, item]));

  let ukupnaCijena = 0;
  const stavke: OrderItemDTO[] = [];

  for (const line of data.cart) {
    const item = menuById.get(line.menuItemId);
    if (!item || !item.dostupno) {
      return { ok: false, error: `Artikl "${item?.naziv ?? ""}" trenutno nije dostupan.` };
    }

    const groupsById = new Map(item.optionGroups.map((group) => [group.id, group]));
    const selectedByGroup = new Map<string, string[]>();
    for (const sel of line.selectedOptions) {
      if (!groupsById.has(sel.groupId)) {
        return { ok: false, error: `Neispravna opcija za "${item.naziv}".` };
      }
      const list = selectedByGroup.get(sel.groupId) ?? [];
      list.push(sel.optionId);
      selectedByGroup.set(sel.groupId, list);
    }

    let jedinicnaCijena = item.cijena;
    const odabraneOpcije: { grupa: string; opcija: string; doplata: number }[] = [];

    for (const group of item.optionGroups) {
      const selectedIds = selectedByGroup.get(group.id) ?? [];
      if (group.obavezno && selectedIds.length === 0) {
        return { ok: false, error: `Odaberi opciju za "${group.naziv}" (${item.naziv}).` };
      }
      if (group.selectionType === "single" && selectedIds.length > 1) {
        return { ok: false, error: `Za "${group.naziv}" (${item.naziv}) može se odabrati samo jedna opcija.` };
      }
      for (const optionId of selectedIds) {
        const option = group.options.find((o) => o.id === optionId);
        if (!option || !option.dostupno) {
          return { ok: false, error: `Opcija nije dostupna za "${item.naziv}".` };
        }
        jedinicnaCijena += option.doplata;
        odabraneOpcije.push({ grupa: group.naziv, opcija: option.naziv, doplata: option.doplata });
      }
    }

    const cijenaUkupno = jedinicnaCijena * line.quantity;
    ukupnaCijena += cijenaUkupno;
    stavke.push({
      nazivArtikla: item.naziv,
      kolicina: line.quantity,
      jedinicnaCijena,
      cijenaUkupno,
      odabraneOpcije,
    });
  }

  if (data.vrsta === "dostava" && ukupnaCijena < shop.minIznosDostave) {
    return { ok: false, error: `Minimalni iznos za dostavu je ${shop.minIznosDostave.toFixed(2)} €.` };
  }

  const publicToken = crypto.randomUUID();
  saveOrder(publicToken, {
    id: publicToken,
    status: "na_cekanju",
    vrsta: data.vrsta,
    adresaDostave: data.vrsta === "dostava" ? data.adresaDostave : null,
    imeKupca: data.ime.trim(),
    trazenoVrijeme: trazenoVrijeme.toISOString(),
    odmah: data.odmah,
    spremnoU: null,
    napomena: data.napomena.trim(),
    ukupnaCijena,
    createdAt: now.toISOString(),
    shop: {
      naziv: shop.naziv,
      telefon: shop.telefon,
      slug: shop.slug,
      vrijemePripreme: shop.vrijemePripreme,
    },
    stavke,
  });

  return { ok: true, publicToken };
}
