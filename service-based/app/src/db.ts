import { Order } from './type.js';

const orders = new Map<string, Order>();

export function saveOrder(order: Order) {
  orders.set(order.id, order);
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id);
}

export function updateOrder(id: string, data: Partial<Order>): Order | undefined {
  const existing = orders.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...data };
  orders.set(id, updated);
  return updated;
}
