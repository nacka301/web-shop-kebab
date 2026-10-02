# Nova radnja iz JSON datoteke

Radnju dodaješ u produkciju za nekoliko minuta iz jedne datoteke `restaurants/<slug>.json`, bez klikanja po bazi.
Potpun primjer formata je [`primjer-radnja.json`](./primjer-radnja.json).

## Dodavanje nove radnje, korak po korak

1. **Kopiraj primjer:** `restaurants/primjer-radnja.json` → `restaurants/<slug>.json`. `slug` je dio adrese (`/<slug>`): samo mala slova, brojke i crtice. Zabranjeni su `admin` i `api`.
2. **Ispuni podatke.** Polja:

   | Polje | Opis |
   |---|---|
   | `slug`, `naziv`, `opis`, `adresa`, `grad` | osnovni podaci |
   | `accent_color` | boja radnje, `#RRGGBB` |
   | `logo` | emoji ili kratak tekst (npr. `"🍔"`, `"EMMITO"`), ili putanja/URL do slike |
   | `hero_slika` | neobavezno, putanja/URL velike slike na vrhu stranice |
   | `radno_vrijeme` | `pon`…`ned`; `null` = zatvoreno; `[["09:00","23:00"]]`. Ako je drugo vrijeme manje od prvog, radi preko ponoći (`[["09:00","02:00"]]` = do 02:00 sljedećeg dana). Vrijeme je po Europe/Zagreb |
   | `avg_prep_minutes` | prosječno vrijeme pripreme (min) |
   | `owner_email` | e-mail za obavijesti o narudžbama (`null` = bez maila) |
   | `grupe_opcija` | grupe opcija koje definiraš JEDNOM (npr. `umaci`, `prilozi`, `dodaci`) |
   | `kategorije` → `artikli` | `naziv`, `opis`, `cijena` u EUR (npr. `4.5`), `slika` (neobavezno), `bestseller`, `opcije` |

   **Grupe opcija:** `{ "naziv": "Umak", "tip": "single" ili "multi", "obavezna": true/false, "max_select": broj ili null, "opcije": [{ "naziv": "Majoneza", "doplata": 0 }] }`.
   Na artiklu ih dodijeliš imenom: `"opcije": ["umaci", "dodaci"]`. Možeš navesti i cijelu grupu izravno na artiklu.
3. **Slike:** stavi ih u `restaurants/<slug>/img/` i u datoteci navedi `"img/burger.jpg"`. Skripta ih sama uploada u javni Storage bucket `menu-images`. URL (`https://…`) i putanje stranice (`/images/x.jpg`) ostaju kakvi jesu.
4. **Provjera bez baze:** `npm run onboard -- restaurants/<slug>.json --dry-run` ispisuje sažetak (broj kategorija, artikala, grupa opcija, koji artikl ima koje opcije) i ništa ne upisuje.
5. **Upis:** `npm run onboard -- restaurants/<slug>.json`. Skripta ponovno ispiše sažetak, kaže je li radnja nova ili se ažurira i na koju bazu piše, pa pita „Upisati u bazu? (da/ne)”. `--yes` preskače pitanje.
6. **Račun vlasnika:** dodaj `--create-owner` (traži `owner_email` u datoteci). Skripta kreira Supabase Auth korisnika, veže ga uz radnju i **jednom** ispiše privremenu lozinku u terminal; ne sprema se nigdje. Ako korisnik već postoji, lozinka se ne mijenja.
7. **Za probu** dodaj `--demo`: radnja je tada demo i ne prima prave narudžbe. Bez `--demo` radnja prima prave narudžbe.

Potrebno je `.env.local` s `NEXT_PUBLIC_SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` (ključ se nikad ne ispisuje).

### Nepotvrđeni podaci: `TODO`

Mjesto gdje podatak nije potvrđen od vlasnika zamijeni riječju `"TODO"` (vidi [`smash.json`](./smash.json)). Dok u datoteci postoji **ijedan** `TODO`, skripta ODBIJA upis (čak i s `--yes`) i ispiše sva mjesta koja treba ispuniti. Ključevi koji počinju s `_` (npr. `"_napomena"`) su komentari i ignoriraju se.

## Zamjena jelovnika

Uredi datoteku i pokreni `npm run onboard -- restaurants/<slug>.json` ponovno. Skripta je idempotentna: isti `slug` ažurira radnju i jelovnik, ne stvara duplikate.

- Artikli kojih više nema u datoteci se **sakrivaju** (`available = false`), ne brišu se (stare narudžbe ih i dalje spominju).
- Artikl koji vratiš u datoteku opet postaje dostupan.
- Grupe i opcije aktualnih artikala koje si maknuo iz datoteke se brišu (stare narudžbe imaju vlastitu kopiju).
- **Datoteka je izvor istine:** cijene, nazivi i dostupnost se vraćaju na ono što piše u njoj. Ako je vlasnik u adminu nešto promijenio (cijenu, „Nema na stanju”), ponovni upis to prebriše, pa prije toga uskladi datoteku.
- Pauza naručivanja (`accepting_orders`) se **ne dira**.
- Preimenovan artikl ili kategorija smatra se novim: stari se sakrije, novi se stvori.

## Reset lozinke vlasniku

Supabase Dashboard → **Authentication → Users** → klik na korisnika → **Send password recovery** (vlasnik dobiva e-mail), ili **Update user** i upiši novu lozinku. Ponovno pokretanje s `--create-owner` lozinku NE mijenja.

## Uklanjanje radnje iz javnosti (sakriti, ne brisati)

Radnje se ne brišu. U Supabase SQL editoru:

```sql
-- 1) Pauza: stranica ostaje, ali piše da ne prima narudžbe i checkout je onemogućen.
update public.restaurants set accepting_orders = false where slug = '<slug>';

-- 2) Potpuno sakrivanje jelovnika: gost vidi praznu radnju.
update public.menu_items set available = false
where restaurant_id = (select id from public.restaurants where slug = '<slug>');
```

Povratak: `accepting_orders = true`, odnosno ponovno pokreni upis iz datoteke (vraća artikle).
Napomena: adresa `/<slug>` i dalje odgovara dok se radnja ne obriše iz baze, što se namjerno ne radi iz skripte.
