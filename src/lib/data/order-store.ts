import type { OrderStatusDTO } from "@/lib/types";

// SAMO za demo radnje: lažna potvrda živi u memoriji procesa da ekran praćenja ima što prikazati.
// Nakon restarta servera, ili na drugoj serverless instanci, uuid više ne postoji (404). Stvarne
// narudžbe nikad ne prolaze ovuda — one idu u bazu.
const MAX_ORDERS = 200;
const orders = new Map<string, OrderStatusDTO>();

export function saveOrder(id: string, order: OrderStatusDTO) {
  if (orders.size >= MAX_ORDERS) {
    const oldest = orders.keys().next().value;
    if (oldest) orders.delete(oldest);
  }
  orders.set(id, order);
}

export function getOrder(id: string): OrderStatusDTO | null {
  return orders.get(id) ?? null;
}

// Demo narudžba: otkazivanje u memoriji (samo dok je "nova"). Vraća true ako je ovo demo narudžba.
export function cancelDemoOrder(id: string): boolean {
  const order = orders.get(id);
  if (!order) return false;
  if (order.status === "new") orders.set(id, { ...order, status: "cancelled" });
  return true;
}
