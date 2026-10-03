-- Zakazani posao u Supabaseu (pg_cron + pg_net): svake minute zove /api/cron/remind-orders,
-- ali SAMO ako postoji nepotvrđena narudžba, pa kad radnja miruje nema nikakvih poziva.
--
-- Pokreni jednom (u SQL editoru ili: supabase db query --linked -f ...), nakon što zamijeniš:
--   __SITE_URL__    npr. https://web-shop-kebab.vercel.app
--   __CRON_SECRET__ ista vrijednost kao varijabla CRON_SECRET na Vercelu
-- Tajna se NE commita; ovdje stoje samo oznake.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('remind-unconfirmed-orders')
where exists (select 1 from cron.job where jobname = 'remind-unconfirmed-orders');

select cron.schedule(
  'remind-unconfirmed-orders',
  '* * * * *',
  $job$
    select net.http_post(
      url := '__SITE_URL__/api/cron/remind-orders',
      headers := jsonb_build_object('x-cron-secret', '__CRON_SECRET__', 'content-type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 8000
    )
    where exists (
      select 1 from public.orders
      where status = 'new' and reminders_sent < 3 and created_at > now() - interval '30 minutes'
    );
  $job$
);
