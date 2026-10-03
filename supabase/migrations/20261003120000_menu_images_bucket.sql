-- Javni bucket za slike jelovnika. Javni bucket se čita bez politika (po URL-u), a upis rade samo
-- skripte sa service role ključem (nema INSERT/UPDATE/DELETE politika za anon ni authenticated).
-- Zaštićeno provjerom da storage shema postoji (npr. nema je u lokalnom Postgresu za testove).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('menu-images', 'menu-images', true)
    on conflict (id) do update set public = true;
  end if;
end;
$$;
