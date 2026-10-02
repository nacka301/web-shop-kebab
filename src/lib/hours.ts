import type { WeekHours } from "@/lib/types";

// Svo radno vrijeme računa se u zoni radnje, neovisno o zoni servera (Vercel radi u UTC-u)
// ili preglednika. Interno radimo sa "zidnim" vremenom: trenutak se pretvori u milisekunde
// kao da je zidno vrijeme Zagreba UTC, pa je aritmetika po danima i satima trivijalna.
export const SHOP_TIME_ZONE = "Europe/Zagreb";

type ShopHours = { tjedno: WeekHours };
export type OpenWindow = { start: Date; end: Date };
type WallWindow = { start: number; end: number };

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
const SLOT_STEP_MIN = 15;
const LEAD_MIN = 15;
export const MAX_AHEAD_HOURS = 24;

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallMs(date: Date): number {
  const p: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

function fromWall(wall: number): Date {
  const first = wall - (wallMs(new Date(wall)) - wall);
  return new Date(wall - (wallMs(new Date(first)) - first));
}

function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Početak dana (00:00) po zagrebačkom vremenu — za dnevni sažetak.
export function zagrebDayStart(date: Date): Date {
  return fromWall(Math.floor(wallMs(date) / DAY_MS) * DAY_MS);
}

export function formatTime(date: Date): string {
  const wall = new Date(wallMs(date));
  return `${String(wall.getUTCHours()).padStart(2, "0")}:${String(wall.getUTCMinutes()).padStart(2, "0")}`;
}

function windowsStartingOnDay(week: WeekHours, dayStart: number): WallWindow[] {
  const dayOfWeek = new Date(dayStart).getUTCDay();
  return (week[dayOfWeek] ?? []).map(({ otvara, zatvara }) => {
    const open = parseTimeToMinutes(otvara);
    const close = parseTimeToMinutes(zatvara);
    // zatvara <= otvara: radnja se zatvara poslije ponoći, pa kraj pada na sljedeći dan.
    return { start: dayStart + open * MIN_MS, end: dayStart + (close <= open ? close + 1440 : close) * MIN_MS };
  });
}

function activeWallWindow(week: WeekHours, wall: number): WallWindow | null {
  const dayStart = Math.floor(wall / DAY_MS) * DAY_MS;
  // Gledamo i jučerašnje intervale: petak 09:00–02:00 još vrijedi u subotu u 01:00.
  for (const offset of [0, -1]) {
    for (const w of windowsStartingOnDay(week, dayStart + offset * DAY_MS)) {
      if (wall >= w.start && wall < w.end) return w;
    }
  }
  return null;
}

function nextWallWindow(week: WeekHours, wall: number): WallWindow | null {
  const dayStart = Math.floor(wall / DAY_MS) * DAY_MS;
  for (let offset = 0; offset <= 8; offset += 1) {
    const upcoming = windowsStartingOnDay(week, dayStart + offset * DAY_MS)
      .filter((w) => w.start > wall)
      .sort((a, b) => a.start - b.start);
    if (upcoming[0]) return upcoming[0];
  }
  return null;
}

const toWindow = (w: WallWindow): OpenWindow => ({ start: fromWall(w.start), end: fromWall(w.end) });

export function activeWindow(shop: ShopHours, when: Date): OpenWindow | null {
  const w = activeWallWindow(shop.tjedno, wallMs(when));
  return w ? toWindow(w) : null;
}

export function nextWindow(shop: ShopHours, when: Date): OpenWindow | null {
  const w = nextWallWindow(shop.tjedno, wallMs(when));
  return w ? toWindow(w) : null;
}

export function isWithinWorkingHours(shop: ShopHours, when: Date): boolean {
  return activeWallWindow(shop.tjedno, wallMs(when)) !== null;
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

// Termini preuzimanja unutar tekućeg (ili prvog sljedećeg) radnog intervala, najviše
// MAX_AHEAD_HOURS unaprijed. Prelazak ponoći je pokriven jer interval nosi apsolutno vrijeme.
export function pickupSlots(shop: ShopHours, from: Date = new Date()): Date[] {
  const earliest = wallMs(from) + LEAD_MIN * MIN_MS;
  const window = activeWallWindow(shop.tjedno, earliest) ?? nextWallWindow(shop.tjedno, earliest);
  if (!window) return [];

  const step = SLOT_STEP_MIN * MIN_MS;
  const limit = from.getTime() + MAX_AHEAD_HOURS * 3_600_000;
  const slots: Date[] = [];
  for (let wall = Math.ceil(Math.max(window.start, earliest) / step) * step; wall < window.end; wall += step) {
    const slot = fromWall(wall);
    if (slot.getTime() > limit || slots.length >= 96) break;
    slots.push(slot);
  }
  return slots;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// opening_hours jsonb: { "mon": [["09:00","23:00"]], …, "fri": [["09:00","02:00"]] }.
// Dan koji nedostaje ili je prazan = zatvoreno. Nevaljani zapisi se preskaču.
export function parseOpeningHours(raw: unknown): WeekHours {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return DAY_KEYS.map((key) => {
    const list = Array.isArray(source[key]) ? (source[key] as unknown[]) : [];
    return list.flatMap((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) return [];
      const [otvara, zatvara] = pair;
      return typeof otvara === "string" && typeof zatvara === "string" && TIME_RE.test(otvara) && TIME_RE.test(zatvara)
        ? [{ otvara, zatvara }]
        : [];
    });
  });
}

const DAY_LABELS: Record<number, string> = { 1: "Pon", 2: "Uto", 3: "Sri", 4: "Čet", 5: "Pet", 6: "Sub", 0: "Ned" };

// ["Pon–Čet 09:00 – 23:00", "Pet–Sub 09:00 – 02:00", "Ned 16:00 – 22:00"]
export function formatHoursLines(week: WeekHours): string[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: { days: number[]; text: string }[] = [];
  for (const day of order) {
    const text = (week[day] ?? []).map((w) => `${w.otvara} – ${w.zatvara}`).join(", ");
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.days.push(day);
    else groups.push({ days: [day], text });
  }
  return groups.map(({ days, text }) => {
    const label = days.length === 1 ? DAY_LABELS[days[0]] : `${DAY_LABELS[days[0]]}–${DAY_LABELS[days[days.length - 1]]}`;
    return `${label} ${text || "zatvoreno"}`;
  });
}
