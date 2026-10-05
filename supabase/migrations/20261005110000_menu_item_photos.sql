-- Vlasnik sam dodaje slike jela iz admina (kamera ili galerija na mobitelu).
-- Slika ide u javni bucket 'menu-images' u mapu s id-em radnje: <restaurant_id>/<naziv-datoteke>.
-- Vlasnik smije pisati SAMO u mapu svoje radnje; čitanje je javno (bucket je javan).

grant update (image_url) on public.menu_items to authenticated;

do $$
begin
  if to_regclass('storage.objects') is not null then
    create policy "Vlasnik dodaje slike svoje radnje" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'menu-images'
        and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 then public.is_staff_of(((storage.foldername(name))[1])::uuid) else false end
      );
    create policy "Vlasnik mijenja slike svoje radnje" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'menu-images'
        and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 then public.is_staff_of(((storage.foldername(name))[1])::uuid) else false end
      );
    create policy "Vlasnik briše slike svoje radnje" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'menu-images'
        and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 then public.is_staff_of(((storage.foldername(name))[1])::uuid) else false end
      );
  end if;
end;
$$;
