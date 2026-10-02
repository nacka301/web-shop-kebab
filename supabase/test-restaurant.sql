-- Testna radnja koja NIJE demo: prima prave narudžbe u bazu. Radi 24/7 da se može testirati u bilo koje doba.
-- Pokreni ručno u Supabase SQL editoru (ili: supabase db query --linked -f supabase/test-restaurant.sql).
-- Za pravu radnju zamijeni slug/naziv/jelovnik i radno vrijeme (opening_hours: "do" <= "od" znači preko ponoći).

insert into public.restaurants (id, slug, name, description, address, city, logo_text, accent_color, phone, opening_hours, is_demo)
values (
  '00000000-0000-4000-8000-0000000000a1', 'test-radnja', 'Test radnja', 'Probna radnja za provjeru narudžbi.',
  'Ulica 1', 'Zagreb', 'TEST', '#e8491d', null,
  '{"mon":[["00:00","00:00"]],"tue":[["00:00","00:00"]],"wed":[["00:00","00:00"]],"thu":[["00:00","00:00"]],"fri":[["00:00","00:00"]],"sat":[["00:00","00:00"]],"sun":[["00:00","00:00"]]}'::jsonb,
  false
) on conflict (id) do nothing;

insert into public.categories (id, restaurant_id, name, sort)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'Jela', 0)
on conflict (id) do nothing;

insert into public.menu_items (id, restaurant_id, category_id, name, description, price_cents, sort) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', 'Testni burger', 'Samo za probu', 500, 0),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', 'Testni pomfrit', 'Samo za probu', 250, 1)
on conflict (id) do nothing;

insert into public.option_groups (id, item_id, name, type, required, max_select, sort) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 'Umak', 'single', true, null, 0),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c1', 'Dodaci', 'multi', false, 2, 1)
on conflict (id) do nothing;

insert into public.options (id, group_id, name, price_delta_cents, sort) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'Ljuti', 0, 0),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d1', 'Blagi', 0, 1),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000d2', 'Sir', 100, 0),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000d2', 'Slanina', 150, 1)
on conflict (id) do nothing;
