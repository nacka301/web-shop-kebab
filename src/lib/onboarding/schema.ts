import { z } from "zod";

// Format datoteke restaurants/<slug>.json. Ključevi koji počinju s "_" (npr. "_napomena") su
// komentari i ignoriraju se. Nepoznati ostali ključevi su GREŠKA (hvata tipfelere).
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const RESERVED_SLUGS = ["admin", "api"];

// Iznosi u EUR s najviše 2 decimale (5, 5.5, 5.50).
const euro = (max: number) =>
  z
    .number()
    .min(0)
    .max(max)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "najviše 2 decimale");

const windowSchema = z.tuple([z.string().regex(TIME_RE, "oblik HH:MM"), z.string().regex(TIME_RE, "oblik HH:MM")]);
// null ili [] = zatvoreno; "do" manji ili jednak "od" = radi preko ponoći.
const dayHours = z.array(windowSchema).max(3).nullable();

const optionSchema = z.object({ naziv: z.string().trim().min(1).max(60), doplata: euro(50).default(0) }).strict();

export const optionGroupSchema = z
  .object({
    naziv: z.string().trim().min(1).max(60),
    tip: z.enum(["single", "multi"]),
    obavezna: z.boolean().default(false),
    max_select: z.number().int().min(1).nullable().default(null),
    opcije: z.array(optionSchema).min(1),
  })
  .strict()
  .refine((g) => g.tip !== "single" || g.max_select === null || g.max_select === 1, {
    message: "'single' grupa može imati najviše 1 odabir",
    path: ["max_select"],
  })
  .refine((g) => new Set(g.opcije.map((o) => o.naziv.toLowerCase())).size === g.opcije.length, {
    message: "nazivi opcija u grupi moraju biti jedinstveni",
    path: ["opcije"],
  });

// Grupa se na artiklu navodi imenom iz "grupe_opcija" ILI se piše izravno.
const itemOption = z.union([z.string().min(1), optionGroupSchema]);

const itemSchema = z
  .object({
    naziv: z.string().trim().min(1).max(80),
    opis: z.string().trim().max(200).default(""),
    cijena: euro(300),
    slika: z.string().min(1).nullable().optional(),
    bestseller: z.boolean().default(false),
    dostupno: z.boolean().default(true),
    opcije: z.array(itemOption).default([]),
  })
  .strict();

const categorySchema = z.object({ naziv: z.string().trim().min(1).max(60), artikli: z.array(itemSchema).min(1) }).strict();

export const restaurantFileSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "samo mala slova, brojke i crtice")
      .refine((slug) => !RESERVED_SLUGS.includes(slug), "rezervirani slug"),
    naziv: z.string().trim().min(1).max(80),
    opis: z.string().trim().max(300).default(""),
    adresa: z.string().trim().min(1).max(200),
    grad: z.string().trim().min(1).max(80),
    accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "oblik #RRGGBB"),
    // Emoji/kratak tekst (npr. "🍔", "EMMITO") ili putanja/URL do slike.
    logo: z.string().min(1).max(300),
    hero_slika: z.string().min(1).nullable().optional(),
    telefon: z.string().min(3).max(40).nullable().optional(),
    radno_vrijeme: z
      .object({ pon: dayHours, uto: dayHours, sri: dayHours, cet: dayHours, pet: dayHours, sub: dayHours, ned: dayHours })
      .strict(),
    avg_prep_minutes: z.number().int().min(1).max(240).default(15),
    prep_time_label: z.string().max(40).nullable().optional(),
    owner_email: z.string().max(254).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "neispravan e-mail").nullable().optional(),
    grupe_opcija: z.record(z.string().min(1), optionGroupSchema).default({}),
    kategorije: z.array(categorySchema).min(1),
  })
  .strict();

export type RestaurantFile = z.infer<typeof restaurantFileSchema>;
export type OptionGroupDef = z.infer<typeof optionGroupSchema>;

// Ključevi s "_" na vrhu datoteke su komentari.
export function stripComments(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([key]) => !key.startsWith("_")));
}

// Gdje se u datoteci još nalazi "TODO" (nepotvrđeni podatak). Dok ih ima, upis je zabranjen.
export function findTodos(value: unknown, path = "$"): string[] {
  if (typeof value === "string") return value.trim().toUpperCase().startsWith("TODO") ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findTodos(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith("_"))
      .flatMap(([key, child]) => findTodos(child, `${path}.${key}`));
  }
  return [];
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.length ? issue.path.join(".") : "(korijen)"}: ${issue.message}`);
}
