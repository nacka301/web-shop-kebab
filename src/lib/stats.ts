import { zagrebDateKey, zagrebDayStart } from "@/lib/hours";
import { SOURCES, normalizeViewSource, type Source } from "@/lib/sources";

export type StatsView = { day: string; src: string; views: number };
export type StatsOrder = {
  createdAt: string;
  source: string | null;
  status: string;
  items: { name: string; qty: number }[];
};

export type Stats = {
  days: number;
  views: number;
  orders: number;
  // Postotak posjeta koji su postali narudžba; null kad nema posjeta.
  conversion: number | null;
  bySource: { src: Source; views: number; orders: number }[];
  byDay: { day: string; orders: number }[];
  topItems: { name: string; qty: number }[];
  // Premalo podataka za smislene grafove.
  enough: boolean;
};

export const MIN_EVENTS_FOR_CHARTS = 10;
const DAY_MS = 86_400_000;

// Zbrajanje za zadnjih `days` dana (uključujući danas, po zagrebačkom vremenu).
// Narudžbe = sve zaprimljene; top artikli ne uključuju odbijene narudžbe.
export function buildStats(args: { views: StatsView[]; orders: StatsOrder[]; days: number; now: Date }): Stats {
  const { days, now } = args;
  const todayStart = zagrebDayStart(now).getTime();
  // Podne izbjegava probleme oko prijelaza na ljetno/zimsko računanje vremena.
  const dayKeys = Array.from({ length: days }, (_, i) => zagrebDateKey(new Date(todayStart + 12 * 3_600_000 - (days - 1 - i) * DAY_MS)));
  const inRange = new Set(dayKeys);

  const views = args.views.filter((v) => inRange.has(v.day));
  const orders = args.orders.filter((o) => inRange.has(zagrebDateKey(new Date(o.createdAt))));

  const bySource = SOURCES.map((src) => ({
    src,
    views: views.filter((v) => normalizeViewSource(v.src) === src).reduce((sum, v) => sum + v.views, 0),
    orders: orders.filter((o) => (o.source ? normalizeViewSource(o.source) : "other") === src).length,
  }));

  const perDay = new Map<string, number>(dayKeys.map((key) => [key, 0]));
  for (const order of orders) {
    const key = zagrebDateKey(new Date(order.createdAt));
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const itemTotals = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "rejected") continue;
    for (const item of order.items) itemTotals.set(item.name, (itemTotals.get(item.name) ?? 0) + item.qty);
  }

  const totalViews = views.reduce((sum, v) => sum + v.views, 0);
  return {
    days,
    views: totalViews,
    orders: orders.length,
    conversion: totalViews > 0 ? Math.round((orders.length / totalViews) * 1000) / 10 : null,
    bySource,
    byDay: dayKeys.map((day) => ({ day, orders: perDay.get(day) ?? 0 })),
    topItems: [...itemTotals.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
      .slice(0, 5),
    enough: totalViews + orders.length >= MIN_EVENTS_FOR_CHARTS,
  };
}
