-- Stvarne narudžbe: radnje, jelovnik, opcije, narudžbe.
-- Narudžbe se stvaraju ISKLJUČIVO kroz server (service role) preko funkcije create_order.

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  address text not null default '',
  city text not null default '',
  logo_url text,
  -- Tekstualni logo / emoji kad nema slike (npr. 'EMMITO', '🍔').
  logo_text text,
  hero_image_url text,
  accent_color text not null default '#e8491d' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  phone text,
  -- Po danu lista [od, do]; "do" manji ili jednak "od" znači rad preko ponoći (zona Europe/Zagreb):
  -- {"mon": [["09:00","23:00"]], "fri": [["09:00","02:00"]], "sun": [["16:00","22:00"]]}
  opening_hours jsonb not null default '{}'::jsonb,
  accepting_orders boolean not null default true,
  avg_prep_minutes integer not null default 15 check (avg_prep_minutes between 1 and 240),
  -- Slobodan tekst za oznaku pripreme (npr. '10 – 15 min'); ako je null, prikazuje se '≈ N min'.
  prep_time_label text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort integer not null default 0
);
create index categories_restaurant_id_idx on public.categories (restaurant_id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  available boolean not null default true,
  bestseller boolean not null default false,
  sort integer not null default 0
);
create index menu_items_restaurant_id_idx on public.menu_items (restaurant_id);
create index menu_items_category_id_idx on public.menu_items (category_id);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  type text not null check (type in ('single', 'multi')),
  required boolean not null default false,
  max_select integer check (max_select is null or max_select >= 1),
  sort integer not null default 0
);
create index option_groups_item_id_idx on public.option_groups (item_id);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups(id) on delete cascade,
  name text not null,
  price_delta_cents integer not null default 0 check (price_delta_cents >= 0),
  sort integer not null default 0
);
create index options_group_id_idx on public.options (group_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  short_code text not null,
  -- Dan narudžbe po zagrebačkom vremenu; short_code je jedinstven po radnji za taj dan.
  order_date date not null default ((now() at time zone 'Europe/Zagreb')::date),
  customer_name text not null,
  customer_phone text not null,
  pickup_type text not null check (pickup_type in ('asap', 'time')),
  pickup_time timestamptz,
  note text not null default '',
  status text not null default 'new' check (status in ('new', 'accepted', 'ready', 'done', 'rejected')),
  eta_minutes integer check (eta_minutes is null or eta_minutes >= 0),
  reject_reason text,
  total_cents integer not null check (total_cents >= 0),
  source text,
  -- HMAC IP adrese (ne sirova IP) — samo za ograničenje broja narudžbi.
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint orders_short_code_per_day unique (restaurant_id, order_date, short_code),
  constraint orders_time_requires_pickup_time check (pickup_type = 'asap' or pickup_time is not null)
);
create index orders_restaurant_created_idx on public.orders (restaurant_id, created_at desc);
create index orders_ip_hash_created_idx on public.orders (ip_hash, created_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid references public.menu_items(id) on delete set null,
  -- Imena i cijene se kopiraju u trenutku narudžbe: kasnija promjena jelovnika ne mijenja stare narudžbe.
  name_snapshot text not null,
  qty integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  options_snapshot jsonb not null default '[]'::jsonb,
  line_total_cents integer not null check (line_total_cents >= 0)
);
create index order_items_order_id_idx on public.order_items (order_id);

-- RLS na svim tablicama.
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Anonimni korisnik smije samo ČITATI radnje i jelovnik. Za orders i order_items nema NIJEDNE
-- politike pa anonimni upit vraća prazno; upisuje i čita samo service role (zaobilazi RLS).
create policy "Radnje su javne" on public.restaurants
  for select to anon, authenticated using (true);

create policy "Kategorije su javne" on public.categories
  for select to anon, authenticated using (true);

create policy "Dostupni artikli su javni" on public.menu_items
  for select to anon, authenticated using (available = true);

create policy "Grupe opcija dostupnih artikala su javne" on public.option_groups
  for select to anon, authenticated using (
    exists (select 1 from public.menu_items mi where mi.id = option_groups.item_id and mi.available = true)
  );

create policy "Opcije dostupnih artikala su javne" on public.options
  for select to anon, authenticated using (
    exists (
      select 1 from public.option_groups og
        join public.menu_items mi on mi.id = og.item_id
      where og.id = options.group_id and mi.available = true
    )
  );

-- Anon/authenticated nikad ne smiju pisati: dodatno oduzimamo sva prava na pisanje.
revoke insert, update, delete, truncate on
  public.restaurants, public.categories, public.menu_items, public.option_groups, public.options,
  public.orders, public.order_items
from anon, authenticated;

-- Atomarni upis narudžbe + stavki u JEDNOJ transakciji (tijelo funkcije je jedna transakcija).
-- Poziva je samo server nakon što je sam izračunao cijene iz baze. Vraća kratki kod 'A-482'.
create or replace function public.create_order(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_pickup_type text,
  p_pickup_time timestamptz,
  p_note text,
  p_source text,
  p_ip_hash text,
  p_total_cents integer,
  p_items jsonb
)
returns table (order_id uuid, short_code text)
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text;
  v_try integer := 0;
  v_letters constant text := 'ABCDEFGHJKLMNPRSTUVXZ';
begin
  loop
    v_try := v_try + 1;
    v_code := substr(v_letters, 1 + floor(random() * length(v_letters))::integer, 1)
      || '-' || (100 + floor(random() * 900))::integer;
    begin
      insert into public.orders (
        id, restaurant_id, short_code, customer_name, customer_phone, pickup_type, pickup_time,
        note, total_cents, source, ip_hash
      ) values (
        v_id, p_restaurant_id, v_code, p_customer_name, p_customer_phone, p_pickup_type, p_pickup_time,
        coalesce(p_note, ''), p_total_cents, p_source, p_ip_hash
      );
      exit;
    exception when unique_violation then
      if v_try >= 30 then
        raise exception 'short_code_exhausted';
      end if;
    end;
  end loop;

  insert into public.order_items (order_id, item_id, name_snapshot, qty, unit_price_cents, options_snapshot, line_total_cents)
  select
    v_id,
    nullif(i->>'item_id', '')::uuid,
    i->>'name',
    (i->>'qty')::integer,
    (i->>'unit_price_cents')::integer,
    coalesce(i->'options', '[]'::jsonb),
    (i->>'line_total_cents')::integer
  from jsonb_array_elements(p_items) as i;

  return query select v_id, v_code;
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, timestamptz, text, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, timestamptz, text, text, text, integer, jsonb)
  to service_role;
