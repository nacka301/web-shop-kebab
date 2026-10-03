-- Podsjetnici vlasniku: ako nova narudžba ostane nepotvrđena, server ponovno šalje push obavijest.
-- Brojač je na narudžbi da se isti podsjetnik ne pošalje dvaput, a i da stane nakon nekoliko pokušaja.

alter table public.orders
  add column reminders_sent smallint not null default 0,
  add column last_reminded_at timestamptz;

-- Upit podsjetnika gleda samo nepotvrđene narudžbe.
create index orders_unconfirmed_idx on public.orders (created_at) where status = 'new';
