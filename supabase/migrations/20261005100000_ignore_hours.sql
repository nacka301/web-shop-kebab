-- Testni način: radnja se može privremeno postaviti da IGNORIRA radno vrijeme (otvorena 24/7),
-- da se naručivanje može isprobati u bilo koje doba. Vlasnik ga uključuje/isključuje u Postavkama.
-- Zadano je isključeno: prava radnja uvijek poštuje svoje radno vrijeme.

alter table public.restaurants add column ignore_hours boolean not null default false;

-- Stupci radnje su dodijeljeni pojedinačno (owner_email je privatan), pa novi treba izričito otvoriti.
grant select (ignore_hours) on public.restaurants to anon, authenticated;
grant update (ignore_hours) on public.restaurants to authenticated;
