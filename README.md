# Naručivanje za male radnje (SMASH, Vinkovci)

Mobile-first Next.js prototip za naručivanje hrane (customer-facing demo).

## Pokretanje

```bash
npm install
npm run dev
```

Demo rute:

- [/smash](http://localhost:3000/smash) — SMASH, Vinkovci
- [/emmito](http://localhost:3000/emmito) — Emmito, kebab i brza hrana, Daruvar

Početna `/` preusmjerava na `NEXT_PUBLIC_DEFAULT_SLUG`.

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

## Podaci i narudžbe

Radnje, jelovnik i narudžbe žive u Supabaseu (sheme u [`supabase/migrations`](./supabase/migrations)).

- **Stvarne radnje** (`is_demo = false`) spremaju narudžbe: klijent šalje samo id-eve i količine na `POST /api/orders`, a server cijene i opcije računa iz baze i upisuje narudžbu atomarno (`create_order`). Anonimni korisnik ne može čitati ni pisati narudžbe (RLS).
- **Demo radnje** (`emmito`; [`supabase/seed.sql`](./supabase/seed.sql)) nose oznaku "Demo" i ne spremaju ništa — potvrda je lažna.
- Praćenje narudžbe: `/[slug]/narudzba/[id]` (osvježava se svakih 5 s, bez telefona i imena kupca).
- Radno vrijeme je `opening_hours` po danu (`mon`…`sun`, lista `[od, do]`); `do` manji ili jednak `od` znači rad preko ponoći (petak `09:00`–`02:00` = u subotu u 01:00 još otvoreno). Sve se računa u zoni Europe/Zagreb, neovisno o zoni servera.
- Testna radnja koja nije demo: [`supabase/test-restaurant.sql`](./supabase/test-restaurant.sql).

## Admin za vlasnike (`/admin`)

Vlasnik se prijavljuje e-mailom i lozinkom (Supabase Auth, bez javne registracije) i na mobitelu vidi narudžbe uživo: zvuk koji se ponavlja dok ne potvrdi ili odbije, ekran koji ne zaspi, pauza naručivanja, uređivanje jelovnika (cijena, naziv, opis, "Nema na stanju", novi artikl). Može se dodati na početni zaslon.

- Pristup štiti RLS u bazi (anon ključ + sesija, nikad service role u pregledniku): vlasnik radnje A ne može čitati ni mijenjati ništa u radnji B. Test: `tests/rls.test.ts`.
- Račun vlasnika: [`supabase/add-staff.sql`](./supabase/add-staff.sql).
- Uživo preko Realtimea na tablici `orders`, uz rezervni polling svakih 10 s.

## QR, linkovi i statistika

- `/admin/qr`: javni link s gumbom "Kopiraj", QR kod (SVG i PNG), gotovi linkovi s izvorom (`?src=ig|fb|gmaps|wa|qr`) i upute gdje ih zalijepiti.
- `/admin/qr/plakat`: A4 plakat i naljepnice (6 na A4) za ispis.
- Posjeti se broje preko `POST /api/view` (jedan zbroj po radnji, danu i izvoru; bez IP-a, user-agenta i kolačića; roboti i prijavljeni vlasnik se ne broje). `src` se prihvaća samo iz popisa, ostalo je `other`.
- `/admin/statistika`: posjeti, narudžbe, konverzija, razrada po izvoru, narudžbe po danima i top 5 artikala za 7 i 30 dana.
- Pregled linka (Open Graph/Twitter), favicon i `theme-color` dolaze iz podataka radnje.

## Obavijest e-mailom

Ako radnja ima `owner_email` (Admin → Postavke) i na poslužitelju su postavljeni `RESEND_API_KEY` i `RESEND_FROM`, svaka nova narudžba stiže i na e-mail. Slanje je neblokirajuće (`after()`): ako Resend padne, narudžba se ipak sprema, a u log ide samo status greške. Demo radnje ne šalju ništa. `owner_email` nije javan: čita se samo preko funkcije `get_owner_email`.

## Dodavanje nove radnje

Nova radnja ide iz jedne JSON datoteke: `npm run onboard -- restaurants/<slug>.json` (sažetak i potvrda prije upisa, idempotentno, `--create-owner`, `--demo`). Upute korak po korak: [`restaurants/README.md`](./restaurants/README.md).

## Testovi

```bash
npm test          # cijene, validacija, radno vrijeme + SQL i RLS na Postgresu u memoriji (bez Dockera)
npm run test:e2e  # narudžbe protiv prave baze i pokrenutog `npm run dev` (treba .env.local i test-radnju)
npm run test:admin # admin protiv prave baze: prijava, izolacija radnji, Realtime, brojač posjeta
```

Varijable okruženja: vidi [`.env.example`](./.env.example). `SUPABASE_SERVICE_ROLE_KEY` je samo za server — nikad s `NEXT_PUBLIC_` i nikad u repozitorij.

Za QR kod u produkciji kopiraj `.env.example` u `.env.local` i postavi `NEXT_PUBLIC_SHOP_URL` na javni URL radnje. QR kod tada vodi kupca direktno na `/smash`.

## Vercel

1. Otvori [Vercel New Project](https://vercel.com/new).
2. Uvezi GitHub repozitorij `nacka301/web-shop-kebab`.
3. Framework ostavi na `Next.js`, a build command na zadanoj vrijednosti.
4. U **Environment Variables** dodaj:

```env
NEXT_PUBLIC_SHOP_URL=https://tvoj-projekt.vercel.app/smash
```

5. Klikni **Deploy**.

Nakon prvog deploya zamijeni vrijednost `NEXT_PUBLIC_SHOP_URL` stvarnim Vercel URL-om projekta i napravi redeploy kako bi QR kod vodio na javni meni.
