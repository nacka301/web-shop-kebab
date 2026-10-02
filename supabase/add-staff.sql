-- Dodavanje računa vlasnika za jednu radnju (radi ti ručno; javne registracije nema).
--
-- 1) Supabase Dashboard -> Authentication -> Users -> "Add user" -> "Create new user":
--    upiši e-mail i lozinku i ostavi uključeno "Auto Confirm User". Kopiraj UUID novog korisnika.
--    (Authentication -> Sign In / Providers: isključi "Allow new users to sign up".)
-- 2) Zalijepi u SQL editor, zamijeni e-mail i slug, pokreni. Ovako ne moraš kopirati UUID:

insert into public.restaurant_staff (user_id, restaurant_id)
select u.id, r.id
from auth.users u, public.restaurants r
where u.email = 'vlasnik@primjer.hr'   -- e-mail iz koraka 1
  and r.slug = 'test-radnja'           -- slug radnje
on conflict (user_id) do update set restaurant_id = excluded.restaurant_id;

-- Provjera: mora vratiti jedan redak.
select u.email, r.slug from public.restaurant_staff s
join auth.users u on u.id = s.user_id
join public.restaurants r on r.id = s.restaurant_id;
