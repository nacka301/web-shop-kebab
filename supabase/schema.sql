create type public.order_status as enum ('nova', 'u_pripremi', 'spremna', 'preuzeta');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  naziv text not null,
  adresa text not null,
  radno_vrijeme text not null default '10:00 - 23:00',
  aktivan boolean not null default true,
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
  dostupno boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  ime_kupca text not null,
  telefon_kupca text not null,
  stavke jsonb not null,
  ukupna_cijena numeric(10,2) not null check (ukupna_cijena >= 0),
  vrijeme_preuzimanja text not null,
  napomena text not null default '',
  status public.order_status not null default 'nova',
  created_at timestamptz not null default now()
);

alter table public.shops enable row level security;
alter table public.shop_admins enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;

create policy "Javni aktivni shopovi su vidljivi" on public.shops for select using (aktivan = true);
create policy "Admin vidi svoj shop" on public.shops for select using (
  exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = shops.id)
);
create policy "Javni meni je vidljiv" on public.menu_items for select using (
  dostupno = true and exists (select 1 from public.shops where id = menu_items.shop_id and aktivan = true)
);
create policy "Admin upravlja svojim menijem" on public.menu_items for all using (
  exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = menu_items.shop_id)
) with check (
  exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = menu_items.shop_id)
);
create policy "Kupac može kreirati narudžbu" on public.orders for insert with check (
  exists (select 1 from public.shops where id = orders.shop_id and aktivan = true)
);
create policy "Admin vidi narudžbe svoje radnje" on public.orders for select using (
  exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = orders.shop_id)
);
create policy "Admin mijenja narudžbe svoje radnje" on public.orders for update using (
  exists (select 1 from public.shop_admins where user_id = auth.uid() and shop_id = orders.shop_id)
);

alter publication supabase_realtime add table public.orders;
