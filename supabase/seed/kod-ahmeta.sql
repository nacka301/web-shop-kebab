-- Testna radnja za razvoj: naruči na /kod-ahmeta
-- Pokreni nakon schema.sql u Supabase SQL editoru.

insert into public.shops (slug, naziv, adresa, logo, telefon, radno_vrijeme, otvara, zatvara, zatvoreno_dani, min_iznos_dostave, aktivan, accepting_orders)
values ('kod-ahmeta', 'Kod Ahmeta', 'Ilica 1, Zagreb', '🥙', '+385 91 234 5678', '10:00 - 22:00', '10:00', '22:00', '{}', 15, true, true)
on conflict (slug) do nothing;

-- Artikl 1: Kebab u lepinji (Meso: obavezan izbor jedan, Umak: izbor jedan bez doplate, Dodaci: izbor više s doplatom)
insert into public.menu_items (id, shop_id, naziv, opis, cijena, kategorija, slika, dostupno, bestseller, redoslijed)
values ('11111111-1111-1111-1111-111111111101', (select id from public.shops where slug = 'kod-ahmeta'),
        'Kebab u lepinji', 'Domaća lepinja, meso po izboru, umak i salata', 5.50, 'Kebab', null, true, true, 1)
on conflict (id) do nothing;

insert into public.option_groups (id, menu_item_id, naziv, selection_type, obavezno, redoslijed) values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Meso', 'single', true, 1),
  ('11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111101', 'Umak', 'single', false, 2),
  ('11111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111101', 'Dodaci', 'multiple', false, 3)
on conflict (id) do nothing;

insert into public.options (option_group_id, naziv, doplata, redoslijed) values
  ('11111111-1111-1111-1111-111111111111', 'Piletina', 0, 1),
  ('11111111-1111-1111-1111-111111111111', 'Teletina', 1.00, 2),
  ('11111111-1111-1111-1111-111111111112', 'Bijeli luk umak', 0, 1),
  ('11111111-1111-1111-1111-111111111112', 'Ljuti umak', 0, 2),
  ('11111111-1111-1111-1111-111111111112', 'Kečap', 0, 3),
  ('11111111-1111-1111-1111-111111111113', 'Ekstra sir', 1.00, 1),
  ('11111111-1111-1111-1111-111111111113', 'Pomfrit u lepinji', 1.50, 2);

-- Artikl 2: Falafel wrap (Umak: izbor jedan bez doplate)
insert into public.menu_items (id, shop_id, naziv, opis, cijena, kategorija, slika, dostupno, bestseller, redoslijed)
values ('11111111-1111-1111-1111-111111111102', (select id from public.shops where slug = 'kod-ahmeta'),
        'Falafel wrap', 'Tortilja, falafel, svježa salata, umak po izboru', 5.00, 'Wrap', null, true, false, 2)
on conflict (id) do nothing;

insert into public.option_groups (id, menu_item_id, naziv, selection_type, obavezno, redoslijed) values
  ('11111111-1111-1111-1111-111111111121', '11111111-1111-1111-1111-111111111102', 'Umak', 'single', false, 1)
on conflict (id) do nothing;

insert into public.options (option_group_id, naziv, doplata, redoslijed) values
  ('11111111-1111-1111-1111-111111111121', 'Bijeli luk umak', 0, 1),
  ('11111111-1111-1111-1111-111111111121', 'Tzatziki', 0, 2),
  ('11111111-1111-1111-1111-111111111121', 'Ljuti umak', 0, 3);

-- Artikl 3: Pomfrit (bez opcija)
insert into public.menu_items (shop_id, naziv, opis, cijena, kategorija, dostupno, redoslijed)
values ((select id from public.shops where slug = 'kod-ahmeta'), 'Pomfrit', 'Hrskavi pomfrit', 2.50, 'Prilozi', true, 3);

-- Artikl 4: Coca-Cola 0,5L (bez opcija)
insert into public.menu_items (shop_id, naziv, opis, cijena, kategorija, dostupno, redoslijed)
values ((select id from public.shops where slug = 'kod-ahmeta'), 'Coca-Cola 0,5L', 'Ohlađeno gazirano piće', 2.00, 'Pića', true, 4);
