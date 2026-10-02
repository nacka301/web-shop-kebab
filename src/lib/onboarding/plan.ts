import { createHash } from "node:crypto";
import path from "node:path";
import { formatHoursLines, parseOpeningHours } from "@/lib/hours";
import type { OptionGroupDef, RestaurantFile } from "./schema";

export type Row = Record<string, unknown>;
export class PlanError extends Error {}

export type Plan = {
  slug: string;
  name: string;
  isDemo: boolean;
  ownerEmail: string | null;
  restaurantId: string;
  restaurant: Row;
  categories: Row[];
  items: Row[];
  groups: Row[];
  options: Row[];
  // Lokalne slike koje treba uploadati u bucket menu-images (URL-ovi su već upisani u retke).
  images: { file: string; storagePath: string; url: string }[];
  hoursLines: string[];
  itemSummaries: { category: string; name: string; priceCents: number; groups: string[] }[];
};

// Isti ulaz uvijek daje isti UUID, pa ponovno pokretanje ažurira retke umjesto da pravi duplikate.
export function stableUuid(key: string): string {
  const hex = createHash("sha1").update(key).digest("hex").split("");
  hex[12] = "5";
  hex[16] = "89ab"[parseInt(hex[16], 16) % 4];
  const s = hex.join("").slice(0, 32);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const toCents = (euro: number) => Math.round(euro * 100);
const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif|avif)$/i;
const DAY_KEYS = [["pon", "mon"], ["uto", "tue"], ["sri", "wed"], ["cet", "thu"], ["pet", "fri"], ["sub", "sat"], ["ned", "sun"]] as const;

export function buildPlan(
  file: RestaurantFile,
  // existingRestaurantId: radnja s ovim slugom već postoji (npr. iz seed.sql) — zadržavamo njezin id.
  opts: { baseDir: string; demo: boolean; publicStorageUrl: string; existingRestaurantId?: string }
): Plan {
  const { slug } = file;
  const restaurantId = opts.existingRestaurantId ?? stableUuid(`restaurant:${slug}`);
  const images = new Map<string, Plan["images"][number]>();

  // URL ili putanja na samoj stranici (npr. /images/x.jpg) ostaju kakvi jesu; lokalna datoteka u
  // restaurants/<slug>/img/ se uploada, a u bazu ide javni URL iz Storagea.
  const resolveImage = (ref: string): string => {
    if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;
    const absolute = path.resolve(opts.baseDir, ref);
    const imgDir = path.resolve(opts.baseDir, "img");
    if (!absolute.startsWith(imgDir + path.sep)) throw new PlanError(`Slika "${ref}" mora biti u ${path.join("restaurants", slug, "img")}/`);
    if (!IMAGE_EXT.test(absolute)) throw new PlanError(`"${ref}" nije slika (png, jpg, webp, svg, gif, avif).`);
    const storagePath = `${slug}/${path.basename(absolute)}`;
    const known = images.get(storagePath);
    if (known && known.file !== absolute) throw new PlanError(`Dvije različite slike imaju isto ime "${path.basename(absolute)}".`);
    const url = `${opts.publicStorageUrl.replace(/\/+$/, "")}/${storagePath}`;
    images.set(storagePath, { file: absolute, storagePath, url });
    return url;
  };

  const logoIsImage = /^https?:\/\//i.test(file.logo) || file.logo.startsWith("/") || IMAGE_EXT.test(file.logo);

  const openingHours = Object.fromEntries(DAY_KEYS.map(([hr, en]) => [en, file.radno_vrijeme[hr] ?? []]));

  const restaurant: Row = {
    id: restaurantId,
    slug,
    name: file.naziv,
    description: file.opis,
    address: file.adresa,
    city: file.grad,
    logo_url: logoIsImage ? resolveImage(file.logo) : null,
    logo_text: logoIsImage ? null : file.logo,
    hero_image_url: file.hero_slika ? resolveImage(file.hero_slika) : null,
    accent_color: file.accent_color,
    opening_hours: openingHours,
    avg_prep_minutes: file.avg_prep_minutes,
    is_demo: opts.demo,
    // accepting_orders se NAMJERNO ne dira: ponovni upis ne smije prekinuti pauzu koju je vlasnik uključio.
  };
  if (file.telefon !== undefined) restaurant.phone = file.telefon;
  if (file.prep_time_label !== undefined) restaurant.prep_time_label = file.prep_time_label;
  if (file.owner_email !== undefined) restaurant.owner_email = file.owner_email;

  const categories: Row[] = [];
  const items: Row[] = [];
  const groups: Row[] = [];
  const options: Row[] = [];
  const itemSummaries: Plan["itemSummaries"] = [];
  const seenCategories = new Set<string>();

  file.kategorije.forEach((category, categoryIndex) => {
    const categoryKey = category.naziv.toLowerCase();
    if (seenCategories.has(categoryKey)) throw new PlanError(`Kategorija "${category.naziv}" se pojavljuje dvaput.`);
    seenCategories.add(categoryKey);
    const categoryId = stableUuid(`cat:${slug}:${category.naziv}`);
    categories.push({ id: categoryId, restaurant_id: restaurantId, name: category.naziv, sort: categoryIndex });

    const seenItems = new Set<string>();
    category.artikli.forEach((item, itemIndex) => {
      const itemKey = item.naziv.toLowerCase();
      if (seenItems.has(itemKey)) throw new PlanError(`Artikl "${item.naziv}" se pojavljuje dvaput u kategoriji "${category.naziv}".`);
      seenItems.add(itemKey);
      const itemId = stableUuid(`item:${slug}:${category.naziv}:${item.naziv}`);

      items.push({
        id: itemId,
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: item.naziv,
        description: item.opis,
        price_cents: toCents(item.cijena),
        image_url: item.slika ? resolveImage(item.slika) : null,
        // Datoteka je izvor istine: artikl koji se vrati u datoteku opet postaje dostupan.
        available: item.dostupno,
        bestseller: item.bestseller,
        sort: itemIndex,
      });

      const groupNames = new Set<string>();
      const groupSummaries: string[] = [];
      item.opcije.forEach((entry, groupIndex) => {
        let def: OptionGroupDef;
        if (typeof entry === "string") {
          const shared = file.grupe_opcija[entry];
          if (!shared) throw new PlanError(`Artikl "${item.naziv}": grupa opcija "${entry}" nije definirana u "grupe_opcija".`);
          def = shared;
        } else {
          def = entry;
        }
        if (groupNames.has(def.naziv.toLowerCase())) throw new PlanError(`Artikl "${item.naziv}": grupa "${def.naziv}" je navedena dvaput.`);
        groupNames.add(def.naziv.toLowerCase());

        const groupId = stableUuid(`group:${itemId}:${def.naziv}`);
        groups.push({
          id: groupId,
          item_id: itemId,
          name: def.naziv,
          type: def.tip,
          required: def.obavezna,
          max_select: def.max_select,
          sort: groupIndex,
        });
        def.opcije.forEach((option, optionIndex) => {
          options.push({
            id: stableUuid(`opt:${groupId}:${option.naziv}`),
            group_id: groupId,
            name: option.naziv,
            price_delta_cents: toCents(option.doplata),
            sort: optionIndex,
          });
        });
        const rule = [def.tip === "single" ? "izbor 1" : `izbor više${def.max_select ? `, najviše ${def.max_select}` : ""}`, def.obavezna ? "obavezno" : "neobavezno"].join(", ");
        const names = def.opcije.map((o) => (o.doplata > 0 ? `${o.naziv} (+${o.doplata.toFixed(2).replace(".", ",")} €)` : o.naziv));
        groupSummaries.push(`${def.naziv} [${rule}]: ${names.join(", ")}`);
      });

      itemSummaries.push({ category: category.naziv, name: item.naziv, priceCents: toCents(item.cijena), groups: groupSummaries });
    });
  });

  return {
    slug,
    name: file.naziv,
    isDemo: opts.demo,
    ownerEmail: file.owner_email ?? null,
    restaurantId,
    restaurant,
    categories,
    items,
    groups,
    options,
    images: [...images.values()],
    hoursLines: formatHoursLines(parseOpeningHours(openingHours)),
    itemSummaries,
  };
}

const euro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

// SAŽETAK koji se ispisuje prije upisa u bazu.
export function describePlan(plan: Plan): string[] {
  const uniqueGroups = new Set(plan.groups.map((g) => `${g.name}`)).size;
  const lines = [
    `Radnja: ${plan.name} (/${plan.slug}) — ${plan.isDemo ? "DEMO (ne prima prave narudžbe)" : "PRAVA radnja (prima prave narudžbe)"}`,
    `Radno vrijeme: ${plan.hoursLines.join(" · ")}`,
    `Kategorija: ${plan.categories.length} · artikala: ${plan.items.length} · grupa opcija: ${plan.groups.length} (${uniqueGroups} različitih) · opcija: ${plan.options.length}`,
    `Obavijesti na e-mail: ${plan.ownerEmail ?? "isključene (nema owner_email)"}`,
    `Slika za upload u Storage: ${plan.images.length}`,
    "",
  ];
  let currentCategory = "";
  for (const item of plan.itemSummaries) {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      lines.push(`${currentCategory}:`);
    }
    lines.push(`  • ${item.name} — ${euro(item.priceCents)}`);
    if (item.groups.length === 0) lines.push("      (bez opcija)");
    for (const group of item.groups) lines.push(`      ${group}`);
  }
  return lines;
}

// ---------- primjena plana na bazu ----------
export type PlanTable = "restaurants" | "categories" | "menu_items" | "option_groups" | "options";

// Apstrakcija nad bazom: Supabase u skripti, PGlite u testovima. Redoslijed i pravila (idempotentnost,
// skrivanje starih artikala) žive ovdje i testiraju se, a implementacije su tanke.
export interface PlanStore {
  upsert(table: PlanTable, rows: Row[]): Promise<void>;
  listIds(table: "menu_items" | "option_groups" | "options", scope: { restaurantId?: string; parentIds?: string[] }): Promise<string[]>;
  hideItems(ids: string[]): Promise<void>;
  deleteIds(table: "option_groups" | "options", ids: string[]): Promise<void>;
}

export type ApplyResult = { hiddenItems: number; deletedGroups: number; deletedOptions: number };

export async function applyPlan(plan: Plan, store: PlanStore): Promise<ApplyResult> {
  await store.upsert("restaurants", [plan.restaurant]);
  await store.upsert("categories", plan.categories);
  await store.upsert("menu_items", plan.items);
  await store.upsert("option_groups", plan.groups);
  await store.upsert("options", plan.options);

  // Artikli kojih više nema u datoteci se SAKRIVAJU (ne brišu), jer ih stare narudžbe i dalje spominju.
  const keepItems = new Set(plan.items.map((i) => i.id as string));
  const staleItems = (await store.listIds("menu_items", { restaurantId: plan.restaurantId })).filter((id) => !keepItems.has(id));
  await store.hideItems(staleItems);

  // Stare grupe i opcije aktualnih artikala (npr. maknut umak) brišu se: stare narudžbe imaju vlastitu kopiju (snapshot).
  const keepGroups = new Set(plan.groups.map((g) => g.id as string));
  const staleGroups = (await store.listIds("option_groups", { parentIds: [...keepItems] })).filter((id) => !keepGroups.has(id));
  await store.deleteIds("option_groups", staleGroups);

  const keepOptions = new Set(plan.options.map((o) => o.id as string));
  const staleOptions = (await store.listIds("options", { parentIds: [...keepGroups] })).filter((id) => !keepOptions.has(id));
  await store.deleteIds("options", staleOptions);

  return { hiddenItems: staleItems.length, deletedGroups: staleGroups.length, deletedOptions: staleOptions.length };
}
