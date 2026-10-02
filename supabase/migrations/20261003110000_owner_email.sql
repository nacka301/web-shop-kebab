-- E-mail vlasnika za obavijest o novoj narudžbi. Ako je prazan, mail se ne šalje.
alter table public.restaurants
  add column owner_email text
  check (owner_email is null or (length(owner_email) <= 254 and owner_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- Tablica restaurants je javno čitljiva (stranica radnje), pa bi osobni e-mail bio vidljiv svakome
-- preko API-ja. Zato se čitanje svodi na POPIS dopuštenih stupaca i owner_email je izostavljen.
-- Novi stupci NISU javni dok ih se izričito ne doda u ovaj popis.
revoke select on public.restaurants from anon, authenticated;
grant select (
  id, slug, name, description, address, city, logo_url, logo_text, hero_image_url, accent_color,
  phone, opening_hours, accepting_orders, avg_prep_minutes, prep_time_label, is_demo, created_at
) on public.restaurants to anon, authenticated;

-- Vlasnik smije promijeniti e-mail svoje radnje (politika za UPDATE već ograničava na njegov redak).
grant update (owner_email) on public.restaurants to authenticated;

-- Vlasnik čita svoj e-mail samo preko ove funkcije; za tuđu radnju vraća null.
create or replace function public.get_owner_email(p_restaurant_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.owner_email from public.restaurants r
  where r.id = p_restaurant_id and public.is_staff_of(p_restaurant_id);
$$;

revoke all on function public.get_owner_email(uuid) from public, anon;
grant execute on function public.get_owner_email(uuid) to authenticated;
