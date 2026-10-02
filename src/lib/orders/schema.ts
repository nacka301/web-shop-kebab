import { z } from "zod";
import { MAX_ITEMS_TOTAL, MAX_QTY_PER_LINE, NAME_MAX, NAME_MIN, NOTE_MAX } from "./limits";

// Klijent NE šalje cijene. Nepoznata polja (npr. lažni `price_cents`) zod odbacuje pri parsiranju.
export const orderRequestSchema = z.object({
  slug: z.string().min(1).max(80),
  items: z
    .array(
      z.object({
        item_id: z.guid(),
        qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
        option_ids: z.array(z.guid()).max(40).default([]),
      })
    )
    .min(1)
    .max(MAX_ITEMS_TOTAL),
  name: z.string().trim().min(NAME_MIN).max(NAME_MAX),
  phone: z.string().max(40),
  pickup_type: z.enum(["asap", "time"]),
  pickup_time: z.iso.datetime({ offset: true }).nullish(),
  note: z.string().trim().max(NOTE_MAX).default(""),
  src: z.string().trim().max(40).nullish(),
  // Honeypot: ljudi ga ne vide ni ne ispunjavaju, botovi često da.
  website: z.string().max(200).optional(),
});

export type OrderRequest = z.infer<typeof orderRequestSchema>;
