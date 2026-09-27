# Grill Box MVP

Mobile-first Next.js prototip za naručivanje hrane (customer-facing demo).

## Pokretanje

```bash
npm install
npm run dev
```

Otvori [http://localhost:3000/grill-box](http://localhost:3000/grill-box) (početna `/` automatski vodi na meni).

## Slike jela — kako dodati svoje

Slike stoje u mapi [`public/images/`](./public/images), a ime datoteke odgovara artiklu, npr. `cheeseburger.jpg`, `fries.jpg`, `hot-dog.jpg`.

Trenutno su ondje **placeholderi** ("Zamijeni svojom slikom"). Da ubaciš pravu fotografiju:

1. Otvori mapu `public/images/`.
2. Zamijeni datoteku svojom fotografijom **pod istim imenom** (npr. spremi svoju sliku kao `cheeseburger.jpg`).
3. Najbolje kvadratna slika (npr. 400×400), format `.jpg`.

To je sve — meni odmah pokazuje tvoju sliku. Ako slika nedostaje, prikazuje se emoji kao rezerva.

## Trenutno uključeno

- hrvatsko mobile-first sučelje za javnu narudžbu (fast food demo)
- kategorije, dostupnost artikala i košarica u client stateu
- izbor preuzimanja ili dostave (uz minimalni iznos za dostavu)
- checkout s imenom, telefonom, adresom, načinom plaćanja i vremenom (odmah ili zakazano)
- potvrda narudžbe s brojem narudžbe

Ovo je samo customer-facing demo — narudžbe se ne spremaju. Demo podaci (radnja, meni) su u [`src/data/demo.ts`](./src/data/demo.ts).

Za QR kod u produkciji kopiraj `.env.example` u `.env.local` i postavi `NEXT_PUBLIC_SHOP_URL` na javni URL radnje. QR kod tada vodi kupca direktno na `/grill-box`.

## Vercel

1. Otvori [Vercel New Project](https://vercel.com/new).
2. Uvezi GitHub repozitorij `nacka301/web-shop-kebab`.
3. Framework ostavi na `Next.js`, a build command na zadanoj vrijednosti.
4. U **Environment Variables** dodaj:

```env
NEXT_PUBLIC_SHOP_URL=https://tvoj-projekt.vercel.app/grill-box
```

5. Klikni **Deploy**.

Nakon prvog deploya zamijeni vrijednost `NEXT_PUBLIC_SHOP_URL` stvarnim Vercel URL-om projekta i napravi redeploy kako bi QR kod vodio na javni meni.
