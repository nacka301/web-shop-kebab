import type { OrderStatusDTO } from "@/lib/types";
import { getOrder } from "./order-store";

export async function fetchOrderByToken(token: string): Promise<OrderStatusDTO | null> {
  return getOrder(token);
}
