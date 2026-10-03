-- 1) Gost može otkazati narudžbu dok je još "nova": novi status 'cancelled'.
alter table public.orders drop constraint orders_status_check;
alter table public.orders
  add constraint orders_status_check check (status in ('new', 'accepted', 'ready', 'done', 'rejected', 'cancelled'));

-- 2) Ograničenje broja narudžbi po IP-u unutar same transakcije.
-- Prije se brojalo u aplikaciji pa upisivalo, pa je 20 istovremenih zahtjeva s iste adrese moglo proći sve odjednom.
-- Sada create_order uzme zaključavanje po IP hashu, prebroji i tek onda upiše, pa je granica točna i pod opterećenjem.
drop function public.create_order(uuid, text, text, text, timestamptz, text, text, text, integer, jsonb);

create function public.create_order(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_pickup_type text,
  p_pickup_time timestamptz,
  p_note text,
  p_source text,
  p_ip_hash text,
  p_total_cents integer,
  p_items jsonb,
  p_max_per_window integer default 0,
  p_window_minutes integer default 10
)
returns table (order_id uuid, short_code text)
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text;
  v_try integer := 0;
  v_recent integer;
  v_letters constant text := 'ABCDEFGHJKLMNPRSTUVXZ';
begin
  if p_max_per_window > 0 and p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
    select count(*) into v_recent
    from public.orders o
    where o.ip_hash = p_ip_hash and o.created_at > now() - make_interval(mins => p_window_minutes);
    if v_recent >= p_max_per_window then
      raise exception 'rate_limited';
    end if;
  end if;

  loop
    v_try := v_try + 1;
    v_code := substr(v_letters, 1 + floor(random() * length(v_letters))::integer, 1)
      || '-' || (100 + floor(random() * 900))::integer;
    begin
      insert into public.orders (
        id, restaurant_id, short_code, customer_name, customer_phone, pickup_type, pickup_time,
        note, total_cents, source, ip_hash
      ) values (
        v_id, p_restaurant_id, v_code, p_customer_name, p_customer_phone, p_pickup_type, p_pickup_time,
        coalesce(p_note, ''), p_total_cents, p_source, p_ip_hash
      );
      exit;
    exception when unique_violation then
      if v_try >= 30 then
        raise exception 'short_code_exhausted';
      end if;
    end;
  end loop;

  insert into public.order_items (order_id, item_id, name_snapshot, qty, unit_price_cents, options_snapshot, line_total_cents)
  select
    v_id,
    nullif(i->>'item_id', '')::uuid,
    i->>'name',
    (i->>'qty')::integer,
    (i->>'unit_price_cents')::integer,
    coalesce(i->'options', '[]'::jsonb),
    (i->>'line_total_cents')::integer
  from jsonb_array_elements(p_items) as i;

  return query select v_id, v_code;
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, timestamptz, text, text, text, integer, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, timestamptz, text, text, text, integer, jsonb, integer, integer)
  to service_role;
