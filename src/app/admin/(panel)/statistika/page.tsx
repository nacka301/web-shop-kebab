import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import { SOURCE_LABELS } from "@/lib/sources";
import { buildStats, type StatsOrder, type StatsView } from "@/lib/stats";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30] as const;

type OrderRow = {
  created_at: string;
  source: string | null;
  status: string;
  order_items: { name_snapshot: string; qty: number }[];
};

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ dana?: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/admin/login");

  const { dana } = await searchParams;
  const days = dana === "30" ? 30 : 7;

  // Sve ide kroz RLS: vlasnik čita samo posjete i narudžbe svoje radnje.
  const supabase = await createSessionClient();
  const now = new Date();
  const since = new Date(now.getTime() - 31 * 86_400_000);
  const [viewsResult, ordersResult] = await Promise.all([
    supabase.from("page_views").select("day, src, views").eq("restaurant_id", context.restaurant.id).gte("day", since.toISOString().slice(0, 10)),
    supabase
      .from("orders")
      .select("created_at, source, status, order_items(name_snapshot, qty)")
      .eq("restaurant_id", context.restaurant.id)
      .gte("created_at", since.toISOString()),
  ]);

  const views: StatsView[] = (viewsResult.data ?? []) as StatsView[];
  const orders: StatsOrder[] = ((ordersResult.data ?? []) as unknown as OrderRow[]).map((row) => ({
    createdAt: row.created_at,
    source: row.source,
    status: row.status,
    items: row.order_items.map((item) => ({ name: item.name_snapshot, qty: item.qty })),
  }));
  const stats = buildStats({ views, orders, days, now });
  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.orders));
  const maxSource = Math.max(1, ...stats.bySource.map((s) => s.views));

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Statistika</h1>
        <div className="flex gap-1.5">
          {PERIODS.map((period) => (
            <Link
              key={period}
              href={`/admin/statistika?dana=${period}`}
              className={`flex min-h-12 items-center rounded-xl px-4 text-sm font-bold ${days === period ? "bg-[var(--brand)] text-white" : "bg-white border border-[var(--border)]"}`}
            >
              {period} dana
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Tile label="Posjeta jelovniku" value={String(stats.views)} />
        <Tile label="Narudžbi" value={String(stats.orders)} />
        <Tile label="Posjeta → narudžba" value={stats.conversion === null ? "—" : `${String(stats.conversion).replace(".", ",")} %`} />
      </div>

      {!stats.enough ? (
        <p className="mt-6 rounded-2xl border border-dashed border-black/20 bg-white px-4 py-10 text-center text-base font-bold text-[var(--muted)]">
          Još nema dovoljno podataka.
          <span className="mt-1 block text-sm font-medium">Čim gosti počnu dolaziti preko QR koda i linkova, ovdje će se pojaviti razrada po izvoru, narudžbe po danima i najprodavaniji artikli.</span>
        </p>
      ) : (
        <>
          <Section title="Odakle dolaze gosti">
            <div className="space-y-3">
              {stats.bySource.map((row) => (
                <div key={row.src}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold">{SOURCE_LABELS[row.src]}</span>
                    <span className="text-[var(--muted)]">{row.views} posjeta · {row.orders} narudžbi</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(row.views / maxSource) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Narudžbe po danima">
            <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Narudžbe po danima">
              {stats.byDay.map((day) => (
                <div key={day.day} className="flex h-full flex-1 flex-col justify-end" title={`${day.day}: ${day.orders}`}>
                  <div className="w-full rounded-t bg-[var(--brand)]" style={{ height: `${(day.orders / maxDay) * 100}%`, minHeight: day.orders > 0 ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
              <span>{formatDay(stats.byDay[0].day)}</span>
              <span>najviše {maxDay} u danu</span>
              <span>{formatDay(stats.byDay[stats.byDay.length - 1].day)}</span>
            </div>
          </Section>

          <Section title="Top 5 artikala">
            {stats.topItems.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Još nema prihvaćenih narudžbi.</p>
            ) : (
              <ol className="space-y-2">
                {stats.topItems.map((item, index) => (
                  <li key={item.name} className="flex items-center gap-3 text-base">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-sm font-extrabold">{index + 1}</span>
                    <span className="flex-1 font-bold">{item.name}</span>
                    <span className="text-[var(--muted)]">{item.qty} kom</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-[var(--muted)]">Top artikli ne uključuju odbijene narudžbe.</p>
          </Section>
        </>
      )}
    </main>
  );
}

const formatDay = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}.`;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-3 card-shadow">
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-semibold text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow">
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      {children}
    </section>
  );
}
