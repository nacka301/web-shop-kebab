import type { OrderStatusDTO } from "@/lib/types";

// Demo nema bazu — potvrđene narudžbe žive u memoriji procesa samo da ekran potvrde
// (/[slug]/narudzba/[token]) ima što prikazati. Nakon restarta servera, ili na drugoj
// serverless instanci, token više ne postoji i stranica vraća 404. To je prihvatljivo
// jer se narudžbe nigdje stvarno ne šalju.
const MAX_ORDERS = 200;
const orders = new Map<string, OrderStatusDTO>();

export function saveOrder(token: string, order: OrderStatusDTO) {
  if (orders.size >= MAX_ORDERS) {
    const oldest = orders.keys().next().value;
    if (oldest) orders.delete(oldest);
  }
  orders.set(token, order);
}

export function getOrder(token: string): OrderStatusDTO | null {
  return orders.get(token) ?? null;
}
