-- Web push obavijesti za vlasnike: svaki uređaj na kojem je uključena obavijest ima jedan redak.
-- Vlasnik upravlja SAMO pretplatama svoje radnje; slanje radi server (service role) iz /api/orders.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_restaurant_id_idx on public.push_subscriptions (restaurant_id);

alter table public.push_subscriptions enable row level security;

create policy "Vlasnik čita pretplate svoje radnje" on public.push_subscriptions
  for select to authenticated using (public.is_staff_of(restaurant_id));
create policy "Vlasnik dodaje pretplatu za svoju radnju" on public.push_subscriptions
  for insert to authenticated
  with check (public.is_staff_of(restaurant_id) and user_id = (select auth.uid()));
create policy "Vlasnik mijenja pretplatu svoje radnje" on public.push_subscriptions
  for update to authenticated
  using (public.is_staff_of(restaurant_id) and user_id = (select auth.uid()))
  with check (public.is_staff_of(restaurant_id) and user_id = (select auth.uid()));
create policy "Vlasnik briše pretplatu svoje radnje" on public.push_subscriptions
  for delete to authenticated using (public.is_staff_of(restaurant_id));

revoke all on public.push_subscriptions from anon;
revoke truncate on public.push_subscriptions from authenticated;
