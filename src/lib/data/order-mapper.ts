// Preostalo iz Supabase varijante (get_order_by_token RPC). Trenutni tok čita narudžbe
// iz memorije (src/lib/data/order-store.ts), pa ovaj mapper nitko ne koristi.
import type { OrderStatusDTO } from "@/lib/types";

type RawOrderItem = {
  naziv_artikla: string;
  kolicina: number;
  jedinicna_cijena: number;
  cijena_ukupno: number;
  odabrane_opcije: { grupa: string; opcija: string; doplata: number }[];
};

type RawOrder = {
  id: string;
  status: OrderStatusDTO["status"];
  vrsta: OrderStatusDTO["vrsta"];
  adresa_dostave: string | null;
  ime_kupca: string;
  trazeno_vrijeme: string;
  odmah: boolean;
  spremno_u: string | null;
  napomena: string;
  ukupna_cijena: number;
  created_at: string;
  shop: { naziv: string; telefon: string | null; slug: string; vrijeme_pripreme?: string };
  stavke: RawOrderItem[];
};

export function mapOrderRpc(raw: RawOrder): OrderStatusDTO {
  return {
    id: raw.id,
    status: raw.status,
    vrsta: raw.vrsta,
    adresaDostave: raw.adresa_dostave,
    imeKupca: raw.ime_kupca,
    trazenoVrijeme: raw.trazeno_vrijeme,
    odmah: raw.odmah,
    spremnoU: raw.spremno_u,
    napomena: raw.napomena,
    ukupnaCijena: Number(raw.ukupna_cijena),
    createdAt: raw.created_at,
    shop: { ...raw.shop, vrijemePripreme: raw.shop.vrijeme_pripreme ?? "" },
    stavke: raw.stavke.map((item) => ({
      nazivArtikla: item.naziv_artikla,
      kolicina: item.kolicina,
      jedinicnaCijena: Number(item.jedinicna_cijena),
      cijenaUkupno: Number(item.cijena_ukupno),
      odabraneOpcije: item.odabrane_opcije,
    })),
  };
}
