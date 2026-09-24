# Mambo Kebab MVP

Mobile-first Next.js prototip za naručivanje hrane s javnim menijem i admin dashboardom.

## Pokretanje

```bash
npm install
npm run dev
```

Otvori [http://localhost:3000/kebab-mambo](http://localhost:3000/kebab-mambo).
Admin demo je na [http://localhost:3000/kebab-mambo/admin](http://localhost:3000/kebab-mambo/admin).

## Trenutno uključeno

- hrvatsko mobile-first sučelje za javnu narudžbu
- kategorije, dostupnost artikala i košarica u client stateu
- checkout s imenom, telefonom, napomenom i brzim vremenima preuzimanja
- potvrda narudžbe s brojem narudžbe
- admin Kanban za statuse `nova`, `u_pripremi`, `spremna` i `preuzeta`
- admin toggle dostupnosti artikala
- početna Supabase shema s multi-tenant RLS politikama u [`supabase/schema.sql`](./supabase/schema.sql)

Demo podaci su u [`src/data/demo.ts`](./src/data/demo.ts). Sljedeći korak za produkciju je zamjena demo sloja Supabase klijentom, Auth prijavom i Realtime subscriptionom nad `orders` tablicom.

Za QR kod u produkciji kopiraj `.env.example` u `.env.local` i postavi `NEXT_PUBLIC_SHOP_URL` na javni URL radnje. QR kod tada vodi kupca direktno na `/kebab-mambo`.

## Vercel

1. Otvori [Vercel New Project](https://vercel.com/new).
2. Uvezi GitHub repozitorij `nacka301/web-shop-kebab`.
3. Framework ostavi na `Next.js`, a build command na zadanoj vrijednosti.
4. U **Environment Variables** dodaj:

```env
NEXT_PUBLIC_SHOP_URL=https://tvoj-projekt.vercel.app/kebab-mambo
```

5. Klikni **Deploy**.

Nakon prvog deploya zamijeni vrijednost `NEXT_PUBLIC_SHOP_URL` stvarnim Vercel URL-om projekta i napravi redeploy kako bi QR kod vodio na javni meni.
