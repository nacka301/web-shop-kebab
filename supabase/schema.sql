create type public.order_status as enum (
  'na_cekanju',   -- Čeka potvrdu
  'prihvacena',   -- Prihvaćeno, spremno u HH:MM (vidi spremno_u)
  'spremna',      -- Spremno za preuzimanje
  'odbijena'      -- Odbijeno
);

create type public.selection_type as enum ('single', 'multiple');

create type public.order_type as enum ('preuzimanje', 'dostava');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  naziv text not null,
  adresa text not null,
  logo text not null default '🍽️',
  telefon text not null,
  radno_vrijeme text not null default '10:00 - 22:00',
  otvara time not null default '10:00',
  zatvara time not null default '22:00',
  zatvoreno_dani smallint[] not null default '{}'::smallint[],
  min_iznos_dostave numeric(10,2) not null default 15,
  aktivan boolean not null default true,
  accepting_orders boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  naziv text not null,
  opis text not null default '',
  cijena numeric(10,2) not null check (cijena >= 0),
  kategorija text not null,
  slika text,
  dostupno boolean not null default true,
  bestseller boolean not null default false,
  redoslijed integer not null default 0,
  created_at timestamptz not null default now()
);
create index menu_items_shop_id_idx on public.menu_items (shop_id);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  naziv text not null,
  selection_type public.selection_type not null,
  obavezno boolean not null default false,
  redoslijed integer not null default 0
);
create index option_groups_menu_item_id_idx on public.option_groups (menu_item_id);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.option_groups(id) on delete cascade,
  naziv text not null,
  doplata numeric(10,2) not null default 0 check (doplata >= 0),
  dostupno boolean not null default true,
  redoslijed integer not null default 0
);
create index options_option_group_id_idx on public.options (option_group_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  vrsta public.order_type not null default 'preuzimanje',
  adresa_dostave text,
  ime_kupca text not null,
  telefon_kupca text not null,
  trazeno_vrijeme timestamptz not null,
  odmah boolean not null default false,
  napomena text not null default '',
  status public.order_status not null default 'na_cekanju',
  spremno_u timestamptz,
  ukupna_cijena numeric(10,2) not null check (ukupna_cijena >= 0),
  created_at timestamptz not null default now(),
  constraint adresa_dostave_required check (vrsta = 'preuzimanje' or adresa_dostave is not null)
);
create index orders_shop_id_idx on public.orders (shop_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  naziv_artikla text not null,
  kolicina integer not null check (kolicina > 0),
  jedinicna_cijena numeric(10,2) not null check (jedinicna_cijena >= 0),
  cijena_ukupno numeric(10,2) not null check (cijena_ukupno >= 0),
  odabrane_opcije jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index order_items_order_id_idx on public.order_items (order_id);

alter table public.shops enable row level security;
alter table public.shop_admins enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Javni aktivni shopovi su vidljivi" on public.shops
  for select using (aktivan = true);
create policy "Admin vidi svoj shop" on public.shops
  for select using (exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = shops.id));

create policy "Javni meni je vidljiv" on public.menu_items
  for select using (
    dostupno = true and exists (select 1 from public.shops where id = menu_items.shop_id and aktivan = true)
  );
create policy "Admin upravlja svojim menijem" on public.menu_items
  for all using (
    exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = menu_items.shop_id)
  ) with check (
    exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = menu_items.shop_id)
  );

create policy "Javne grupe opcija su vidljive" on public.option_groups
  for select using (
    exists (
      select 1 from public.menu_items mi join public.shops s on s.id = mi.shop_id
      where mi.id = option_groups.menu_item_id and mi.dostupno = true and s.aktivan = true
    )
  );
create policy "Admin upravlja grupama opcija" on public.option_groups
  for all using (
    exists (select 1 from public.menu_items mi join public.shop_admins sa on sa.shop_id = mi.shop_id
            where mi.id = option_groups.menu_item_id and sa.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.menu_items mi join public.shop_admins sa on sa.shop_id = mi.shop_id
            where mi.id = option_groups.menu_item_id and sa.user_id = auth.uid())
  );

create policy "Javne opcije su vidljive" on public.options
  for select using (
    dostupno = true and exists (
      select 1 from public.option_groups og
        join public.menu_items mi on mi.id = og.menu_item_id
        join public.shops s on s.id = mi.shop_id
      where og.id = options.option_group_id and mi.dostupno = true and s.aktivan = true
    )
  );
create policy "Admin upravlja opcijama" on public.options
  for all using (
    exists (select 1 from public.option_groups og
              join public.menu_items mi on mi.id = og.menu_item_id
              join public.shop_admins sa on sa.shop_id = mi.shop_id
            where og.id = options.option_group_id and sa.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.option_groups og
              join public.menu_items mi on mi.id = og.menu_item_id
              join public.shop_admins sa on sa.shop_id = mi.shop_id
            where og.id = options.option_group_id and sa.user_id = auth.uid())
  );

-- orders/order_items: anon smije samo INSERT, nikad SELECT/UPDATE/DELETE izravno.
-- Fino-zrnate provjere (radno vrijeme, dostupnost artikala, minimalni iznos za dostavu,
-- cijena) rade se u server actionu prije inserta — RLS ovdje izražava samo grubu provjeru
-- da je radnja aktivna i da prima narudžbe.
create policy "Kupac može kreirati narudžbu" on public.orders
  for insert with check (
    exists (select 1 from public.shops where id = orders.shop_id and aktivan = true and accepting_orders = true)
  );
create policy "Admin vidi narudžbe svoje radnje" on public.orders
  for select using (exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = orders.shop_id));
create policy "Admin mijenja narudžbe svoje radnje" on public.orders
  for update using (exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = orders.shop_id));

-- order_items provjerava preko vlastitog (denormaliziranog) shop_id, ne preko orders —
-- jer orders nema anon SELECT policy, pa bi join na orders unutar ovog WITH CHECK-a
-- (koji se i sam evaluira pod RLS-om kao rola anon) vratio 0 redaka.
create policy "Kupac može dodati stavke narudžbe" on public.order_items
  for insert with check (
    exists (select 1 from public.shops where id = order_items.shop_id and aktivan = true and accepting_orders = true)
  );
create policy "Admin vidi stavke narudžbi svoje radnje" on public.order_items
  for select using (exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = order_items.shop_id));

-- get_order_by_token: jedini način na koji anonimni gost "vidi" svoju narudžbu.
-- orders/order_items namjerno nemaju SELECT policy za anon (bilo koja bi otvorila
-- enumeraciju tuđih narudžbi preko REST API-ja). SECURITY DEFINER zaobilazi RLS interno,
-- ali vraća točno jedan redak određen tokenom — public_token ima ~122 bita entropije,
-- pa je poznavanje tokena samo po sebi autorizacija (isti princip kao neslučajni share-link).
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'vrsta', o.vrsta,
    'adresa_dostave', o.adresa_dostave,
    'ime_kupca', o.ime_kupca,
    'trazeno_vrijeme', o.trazeno_vrijeme,
    'odmah', o.odmah,
    'spremno_u', o.spremno_u,
    'napomena', o.napomena,
    'ukupna_cijena', o.ukupna_cijena,
    'created_at', o.created_at,
    'shop', jsonb_build_object('naziv', s.naziv, 'telefon', s.telefon, 'slug', s.slug),
    'stavke', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'naziv_artikla', oi.naziv_artikla,
        'kolicina', oi.kolicina,
        'jedinicna_cijena', oi.jedinicna_cijena,
        'cijena_ukupno', oi.cijena_ukupno,
        'odabrane_opcije', oi.odabrane_opcije
      )), '[]'::jsonb)
      from public.order_items oi where oi.order_id = o.id
    )
  )
  into result
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.public_token = p_token;

  return result; -- null ako token ne postoji -> aplikacija to tretira kao notFound()
end;
$$;

revoke all on function public.get_order_by_token(uuid) from public;
grant execute on function public.get_order_by_token(uuid) to anon, authenticated;
