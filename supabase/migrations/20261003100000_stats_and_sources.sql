-- Brojanje posjeta po radnji, danu i izvoru (qr, ig, fb, gmaps, wa, other).
-- Ne sprema se IP, user-agent ni išta osobno: samo zbroj posjeta.

create table public.page_views (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day date not null,
  src text not null check (src in ('qr', 'ig', 'fb', 'gmaps', 'wa', 'other')),
  views integer not null default 0 check (views >= 0),
  primary key (restaurant_id, day, src)
);

alter table public.page_views enable row level security;

-- Anonimac ne čita ništa; vlasnik čita samo svoju radnju. Pisanje ide isključivo kroz funkciju ispod.
create policy "Vlasnik čita posjete svoje radnje" on public.page_views
  for select to authenticated using (public.is_staff_of(restaurant_id));
revoke all on public.page_views from anon;
revoke insert, update, delete, truncate on public.page_views from authenticated;

-- Jedan redak po radnji, danu (po zagrebačkom vremenu) i izvoru; UPSERT s povećanjem brojača.
create or replace function public.increment_page_view(p_restaurant_id uuid, p_src text)
returns void
language sql
set search_path = public
as $$
  insert into public.page_views as pv (restaurant_id, day, src, views)
  values (
    p_restaurant_id,
    (now() at time zone 'Europe/Zagreb')::date,
    case when p_src in ('qr', 'ig', 'fb', 'gmaps', 'wa') then p_src else 'other' end,
    1
  )
  on conflict (restaurant_id, day, src) do update set views = pv.views + 1;
$$;

revoke all on function public.increment_page_view(uuid, text) from public, anon, authenticated;
grant execute on function public.increment_page_view(uuid, text) to service_role;

-- Izvor narudžbe je samo iz fiksnog popisa (ili prazan kad gost dolazi izravno).
alter table public.orders
  add constraint orders_source_known check (source is null or source in ('qr', 'ig', 'fb', 'gmaps', 'wa', 'other'));
