"use client";

import { useMemo, useState } from "react";
import { Camera, Pencil, Plus } from "lucide-react";
import type { AdminRestaurant } from "@/lib/admin/context";
import { formatEuro } from "@/lib/admin/orders";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { fetchAdminMenu, parseEuroToCents, uploadMenuPhoto, type AdminMenu, type AdminMenuItem } from "./menu-data";

const field =
  "mt-1 min-h-12 w-full rounded-xl border border-black/15 bg-white px-3 text-base outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";
const btn = "min-h-12 rounded-xl px-4 text-base font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

export default function MenuManager({ restaurant, initial }: { restaurant: AdminRestaurant; initial: AdminMenu }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [menu, setMenu] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      setMenu(await fetchAdminMenu(supabase, restaurant.id));
    } catch {
      setError("Jelovnik se nije mogao osvježiti. Provjeri vezu.");
    }
  };

  // Svaka promjena ide ravno u bazu, pa je gosti vide odmah (stranica radnje čita iz iste baze).
  const run = async (action: () => PromiseLike<{ error: unknown; data: unknown[] | null }>, success: string) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    const { error: actionError, data } = await action();
    if (actionError || !data || data.length === 0) setError("Promjena nije spremljena. Pokušaj ponovno.");
    else {
      setSaved(success);
      setEditingId(null);
      setAdding(false);
    }
    await reload();
    setBusy(false);
  };

  const toggleAvailable = (item: AdminMenuItem) =>
    run(
      () => supabase.from("menu_items").update({ available: !item.available }).eq("id", item.id).select("id"),
      item.available ? `„${item.name}” je skriven gostima.` : `„${item.name}” je opet dostupan gostima.`
    );

  const saveEdit = (item: AdminMenuItem, values: { name: string; description: string; price: string }) => {
    const cents = parseEuroToCents(values.price);
    if (!values.name.trim() || cents === null) {
      setError("Upiši naziv i ispravnu cijenu (0 do 300 €).");
      return;
    }
    return run(
      () =>
        supabase
          .from("menu_items")
          .update({ name: values.name.trim(), description: values.description.trim(), price_cents: cents })
          .eq("id", item.id)
          .select("id"),
      `„${values.name.trim()}” je spremljen.`
    );
  };

  // Fotografija jela: smanji se u pregledniku, ide u mapu radnje u javnom bucketu, a link se zapiše uz artikl.
  const uploadPhoto = async (item: AdminMenuItem, file: File) => {
    if (file.size > 25_000_000) {
      setError("Slika je prevelika (najviše 25 MB).");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await uploadMenuPhoto(supabase, restaurant.id, item.id, file);
      setSaved(`Slika za „${item.name}” je spremljena.`);
      await reload();
    } catch {
      setError("Slika nije spremljena. Pokušaj ponovno (druga slika ili bolja veza).");
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (item: AdminMenuItem) =>
    run(() => supabase.from("menu_items").update({ image_url: null }).eq("id", item.id).select("id"), `Slika za „${item.name}” je uklonjena.`);

  const addItem = (values: { name: string; description: string; price: string; categoryId: string }) => {
    const cents = parseEuroToCents(values.price);
    if (!values.name.trim() || cents === null || !values.categoryId) {
      setError("Upiši naziv, ispravnu cijenu (0 do 300 €) i odaberi kategoriju.");
      return;
    }
    const sort = Math.max(0, ...menu.items.filter((i) => i.categoryId === values.categoryId).map((i) => i.sort)) + 1;
    return run(
      () =>
        supabase
          .from("menu_items")
          .insert({
            restaurant_id: restaurant.id,
            category_id: values.categoryId,
            name: values.name.trim(),
            description: values.description.trim(),
            price_cents: cents,
            available: true,
            sort,
          })
          .select("id"),
      `„${values.name.trim()}” je dodan na jelovnik.`
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-8 pt-4 sm:px-6">
      <h1 className="font-display text-2xl">Jelovnik</h1>
      <p className="mt-1 text-base text-[var(--muted)]">Promjene se spremaju odmah i odmah ih vide gosti na stranici radnje.</p>

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-base font-bold text-red-700">{error}</p>}
      {saved && <p role="status" className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-base font-bold text-green-700">{saved} Gosti to već vide.</p>}

      {adding ? (
        <ItemForm
          title="Novi artikl"
          categories={menu.categories}
          busy={busy}
          initial={{ name: "", description: "", price: "", categoryId: menu.categories[0]?.id ?? "" }}
          onCancel={() => setAdding(false)}
          onSubmit={(values) => addItem(values as { name: string; description: string; price: string; categoryId: string })}
        />
      ) : (
        <button onClick={() => setAdding(true)} className={`${btn} mt-4 flex w-full items-center justify-center gap-2 bg-[var(--brand)] text-white`}>
          <Plus className="h-5 w-5" /> Dodaj artikl
        </button>
      )}

      {menu.categories.map((category) => {
        const items = menu.items.filter((item) => item.categoryId === category.id);
        if (items.length === 0) return null;
        return (
          <section key={category.id} className="mt-6">
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--muted)]">{category.name}</h2>
            <div className="space-y-3">
              {items.map((item) =>
                editingId === item.id ? (
                  <ItemForm
                    key={item.id}
                    title={`Uredi: ${item.name}`}
                    busy={busy}
                    initial={{ name: item.name, description: item.description, price: (item.priceCents / 100).toFixed(2).replace(".", ",") }}
                    photo={{ url: item.imageUrl, busy, onPick: (file) => void uploadPhoto(item, file), onRemove: () => void removePhoto(item) }}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => saveEdit(item, values)}
                  />
                ) : (
                  <article key={item.id} className={`rounded-2xl border border-[var(--border)] bg-white p-4 card-shadow ${item.available ? "" : "opacity-60"}`}>
                    <div className="flex items-start gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/[0.05] text-[var(--muted)]">
                          <Camera className="h-6 w-6" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-extrabold leading-tight">{item.name}</h3>
                        {item.description && <p className="mt-0.5 text-base text-[var(--muted)]">{item.description}</p>}
                      </div>
                      <p className="shrink-0 text-lg font-extrabold">{formatEuro(item.priceCents)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-3">
                      <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 text-base font-bold">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={!item.available}
                          disabled={busy}
                          onChange={() => void toggleAvailable(item)}
                          className="relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-black/20 transition-colors before:absolute before:left-1 before:top-1 before:h-6 before:w-6 before:rounded-full before:bg-white before:transition-transform checked:bg-red-600 checked:before:translate-x-6"
                        />
                        <span>Nema na stanju<span className="block text-sm font-medium text-[var(--muted)]">skriveno gostima</span></span>
                      </label>
                      <button onClick={() => { setEditingId(item.id); setError(null); setSaved(null); }} className={`${btn} flex items-center gap-1.5 bg-black/[0.05]`}>
                        <Pencil className="h-4 w-4" /> Uredi
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}

type FormValues = { name: string; description: string; price: string; categoryId?: string };

function ItemForm({
  title,
  initial,
  categories,
  busy,
  photo,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: FormValues;
  categories?: { id: string; name: string }[];
  busy: boolean;
  photo?: { url: string | null; busy: boolean; onPick: (file: File) => void; onRemove: () => void };
  onSubmit: (values: FormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(values);
      }}
      className="mt-4 space-y-3 rounded-2xl border-2 border-[var(--brand)] bg-white p-4"
    >
      <h3 className="text-lg font-extrabold">{title}</h3>
      <label className="block text-base font-bold">
        Naziv
        <input required maxLength={80} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className={field} />
      </label>
      <label className="block text-base font-bold">
        Opis
        <textarea maxLength={200} rows={2} value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} className={`${field} py-2`} />
      </label>
      <label className="block text-base font-bold">
        Cijena (€)
        <input required inputMode="decimal" placeholder="5,50" value={values.price} onChange={(e) => setValues({ ...values, price: e.target.value })} className={field} />
      </label>
      {categories && (
        <label className="block text-base font-bold">
          Kategorija
          <select required value={values.categoryId} onChange={(e) => setValues({ ...values, categoryId: e.target.value })} className={field}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      )}
      {photo && (
        <div className="space-y-2">
          <p className="text-base font-bold">Slika</p>
          {photo.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="" className="h-40 w-full rounded-xl object-cover" />
          )}
          <label className={`${btn} flex w-full cursor-pointer items-center justify-center gap-2 bg-black/[0.05] ${photo.busy ? "opacity-50" : ""}`}>
            <Camera className="h-5 w-5" /> {photo.busy ? "Šaljem sliku…" : photo.url ? "Zamijeni sliku" : "Dodaj sliku"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={photo.busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) photo.onPick(file);
              }}
            />
          </label>
          {photo.url && (
            <button type="button" disabled={photo.busy} onClick={photo.onRemove} className={`${btn} w-full bg-red-50 text-red-700`}>
              Ukloni sliku
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={`${btn} bg-black/[0.05]`}>Odustani</button>
        <button disabled={busy} className={`${btn} bg-[var(--brand)] text-white`}>{busy ? "Spremanje…" : "Spremi"}</button>
      </div>
    </form>
  );
}
