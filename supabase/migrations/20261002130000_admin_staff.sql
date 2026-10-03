-- Admin za vlasnike: prijavljeni korisnik (Supabase Auth) vidi i mijenja SAMO podatke svoje radnje.
-- Admin radi s anon ključem + RLS; service role se u pregledniku nikad ne koristi.
-- Račune vlasnika dodaje administrator ručno (supabase/add-staff.sql).

create table public.restaurant_staff (
  -- Jedan korisnik = jedna radnja (više korisnika po radnji nije dio ovog kruga).
  user_id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade
);
create index restaurant_staff_restaurant_id_idx on public.restaurant_staff (restaurant_id);

alter table public.restaurant_staff enable row level security;

create policy "Vlasnik vidi samo svoj redak" on public.restaurant_staff
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.restaurant_staff from anon;
revoke insert, update, delete, truncate on public.restaurant_staff from authenticated;

-- Je li trenutni korisnik vlasnik te radnje. SECURITY DEFINER da politike ne ovise o RLS-u
-- tablice restaurant_staff (izbjegava rekurziju).
create or replace function public.is_staff_of(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_staff s
    where s.user_id = (select auth.uid()) and s.restaurant_id = p_restaurant_id
  );
$$;

revoke all on function public.is_staff_of(uuid) from public, anon;
grant execute on function public.is_staff_of(uuid) to authenticated;

-- ---------- restaurants: samo prekidač prihvaćanja narudžbi ----------
create policy "Vlasnik mijenja svoju radnju" on public.restaurants
  for update to authenticated
  using (public.is_staff_of(id))
  with check (public.is_staff_of(id));
grant update (accepting_orders) on public.restaurants to authenticated;

-- ---------- orders: čita sve svoje, mijenja samo tijek statusa ----------
create policy "Vlasnik čita narudžbe svoje radnje" on public.orders
  for select to authenticated using (public.is_staff_of(restaurant_id));
create policy "Vlasnik mijenja narudžbe svoje radnje" on public.orders
  for update to authenticated
  using (public.is_staff_of(restaurant_id))
  with check (public.is_staff_of(restaurant_id));
-- Cijene, kupac i sadržaj narudžbe se NE mogu mijenjati — samo status, procjena i razlog odbijanja.
grant update (status, eta_minutes, reject_reason) on public.orders to authenticated;

create policy "Vlasnik čita stavke narudžbi svoje radnje" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and public.is_staff_of(o.restaurant_id)
    )
  );

-- ---------- categories ----------
create policy "Vlasnik dodaje kategorije svoje radnje" on public.categories
  for insert to authenticated with check (public.is_staff_of(restaurant_id));
create policy "Vlasnik mijenja kategorije svoje radnje" on public.categories
  for update to authenticated
  using (public.is_staff_of(restaurant_id))
  with check (public.is_staff_of(restaurant_id));
grant insert (restaurant_id, name, sort) on public.categories to authenticated;
grant update (name, sort) on public.categories to authenticated;

-- ---------- menu_items ----------
-- Vlasnik vidi i nedostupne artikle (gosti vide samo dostupne — vidi politiku iz prve migracije).
create policy "Vlasnik vidi sve artikle svoje radnje" on public.menu_items
  for select to authenticated using (public.is_staff_of(restaurant_id));

-- Kategorija mora pripadati istoj radnji, inače bi se artikl mogao prikvačiti uz tuđu kategoriju.
create policy "Vlasnik dodaje artikle svoje radnje" on public.menu_items
  for insert to authenticated with check (
    public.is_staff_of(restaurant_id)
    and exists (select 1 from public.categories c where c.id = category_id and c.restaurant_id = menu_items.restaurant_id)
  );
create policy "Vlasnik mijenja artikle svoje radnje" on public.menu_items
  for update to authenticated
  using (public.is_staff_of(restaurant_id))
  with check (
    public.is_staff_of(restaurant_id)
    and exists (select 1 from public.categories c where c.id = category_id and c.restaurant_id = menu_items.restaurant_id)
  );
grant insert (restaurant_id, category_id, name, description, price_cents, available, sort) on public.menu_items to authenticated;
grant update (category_id, name, description, price_cents, available, sort) on public.menu_items to authenticated;

-- ---------- Realtime: nove narudžbe uživo (RLS vrijedi i za Realtime) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
exception when duplicate_object then
  null;
end;
$$;

-- /admin i /api su rezervirane rute: radnja s tim slugom bila bi nedostupna.
alter table public.restaurants
  add constraint restaurants_slug_not_reserved check (slug not in ('admin', 'api'));
