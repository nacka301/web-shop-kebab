-- Brisanje i zamjena slike traže i pravo čitanja redaka u storage.objects (DELETE ... RETURNING).
-- Javno čitanje po URL-u radi bez politika, ovo vlasniku samo daje uvid u datoteke SVOJE radnje.
do $$
begin
  if to_regclass('storage.objects') is not null then
    create policy "Vlasnik vidi slike svoje radnje" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'menu-images'
        and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 then public.is_staff_of(((storage.foldername(name))[1])::uuid) else false end
      );
  end if;
end;
$$;
