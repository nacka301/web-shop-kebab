import type { ShopDTO, WeekHours } from "@/lib/types";

type ShopHours = Pick<ShopDTO, "tjedno">;
export type OpenWindow = { start: Date; end: Date };

const MINUTE_MS = 60_000;
const SLOT_STEP_MIN = 15;
// Koliko unaprijed najranije zakazati — pokriva vrijeme pripreme.
const LEAD_MIN = 15;

function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function startOfDay(ref: Date, offsetDays: number) {
  const day = new Date(ref);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + offsetDays);
  return day;
}

// Radni interval koji POČINJE na dan `ref + offsetDays`. Ako je `zatvara <= otvara`,
// radnja se zatvara poslije ponoći, pa kraj pada na sljedeći dan (petak 09:00–02:00
// znači da je u subotu u 01:00 još uvijek otvoren petkov interval).
function windowStartingOn(tjedno: WeekHours, ref: Date, offsetDays: number): OpenWindow | null {
  const day = startOfDay(ref, offsetDays);
  const hours = tjedno[day.getDay()];
  if (!hours) return null;

  const otvaraMin = parseTimeToMinutes(hours.otvara);
  const zatvaraMin = parseTimeToMinutes(hours.zatvara);
  const start = new Date(day);
  start.setMinutes(otvaraMin);
  const end = new Date(day);
  end.setMinutes(zatvaraMin + (zatvaraMin <= otvaraMin ? 24 * 60 : 0));
  return { start, end };
}

// Interval unutar kojeg `when` pada — gleda i jučerašnji interval zbog zatvaranja poslije ponoći.
export function activeWindow(shop: ShopHours, when: Date): OpenWindow | null {
  for (const offset of [0, -1]) {
    const w = windowStartingOn(shop.tjedno, when, offset);
    if (w && when >= w.start && when < w.end) return w;
  }
  return null;
}

// Prvi interval koji počinje nakon `when` (traži do 8 dana unaprijed).
export function nextWindow(shop: ShopHours, when: Date): OpenWindow | null {
  for (let offset = 0; offset <= 8; offset += 1) {
    const w = windowStartingOn(shop.tjedno, when, offset);
    if (w && w.start > when) return w;
  }
  return null;
}

export function isWithinWorkingHours(shop: ShopHours, when: Date): boolean {
  return activeWindow(shop, when) !== null;
}

export function isOpenNow(shop: ShopHours): boolean {
  return isWithinWorkingHours(shop, new Date());
}

// Tekst statusa u heru: "Otvoreno do 02:00" / "Zatvoreno · otvara u 16:00".
export function openStatusLabel(shop: ShopHours, when: Date = new Date()): string {
  const current = activeWindow(shop, when);
  if (current) return `Otvoreno do ${formatTime(current.end)}`;
  const next = nextWindow(shop, when);
  return next ? `Zatvoreno · otvara u ${formatTime(next.start)}` : "Trenutno zatvoreno";
}

// Termini preuzimanja unutar tekućeg (ili prvog sljedećeg) radnog intervala.
// Prelazak ponoći je pokriven jer interval nosi apsolutne datume, pa se termini
// nastavljaju preko 00:00 do stvarnog zatvaranja.
export function pickupSlots(shop: ShopHours, from: Date = new Date()): Date[] {
  const earliest = new Date(from.getTime() + LEAD_MIN * MINUTE_MS);
  const window = activeWindow(shop, earliest) ?? nextWindow(shop, earliest);
  if (!window) return [];

  const cursor = new Date(Math.max(window.start.getTime(), earliest.getTime()));
  cursor.setSeconds(0, 0);
  const remainder = cursor.getMinutes() % SLOT_STEP_MIN;
  if (remainder !== 0) cursor.setMinutes(cursor.getMinutes() + (SLOT_STEP_MIN - remainder));

  const slots: Date[] = [];
  while (cursor < window.end && slots.length < 96) {
    slots.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + SLOT_STEP_MIN);
  }
  return slots;
}

// "HH:MM" iz checkouta -> stvarni datum termina. Vraća null ako termin nije ponuđen,
// čime server odbija svako vrijeme izvan radnog vremena. Rješava i dvoznačnost
// poslije ponoći (01:00 u petak navečer je subota ujutro, ne isti dan).
export function resolveSlot(shop: ShopHours, hhmm: string, from: Date = new Date()): Date | null {
  return pickupSlots(shop, from).find((slot) => formatTime(slot) === hhmm) ?? null;
}
