import { authFetch } from "./auth";

export type Customer = {
  id: number;
  telefono: string;
  nombre: string;
  created_at: string;
};

export async function findCustomerByPhone(telefono: string): Promise<Customer | null> {
  const res = await authFetch(`/api/customers/?telefono=${encodeURIComponent(telefono)}`);
  if (!res.ok) throw new Error("No se pudo buscar el cliente.");
  const results: Customer[] = await res.json();
  return results[0] ?? null;
}

export async function createCustomer(input: { telefono: string; nombre: string }): Promise<Customer> {
  const res = await authFetch("/api/customers/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("No se pudo crear el cliente.");
  return res.json();
}

export type OrderItem = {
  id: number;
  product: number;
  cantidad: string;
  precio_unitario_snapshot: string;
};

export type Order = {
  id: number;
  customer: number;
  canal: "whatsapp" | "manual";
  estado: string;
  notas: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export type OrderCreateInput = {
  customer: number;
  canal: "whatsapp" | "manual";
  notas: string;
  items: { product: number; cantidad: string }[];
};

export async function createOrder(input: OrderCreateInput): Promise<Order> {
  const res = await authFetch("/api/orders/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail ? JSON.stringify(detail) : "No se pudo crear el pedido.");
  }
  return res.json();
}

export async function getOrder(id: number): Promise<Order> {
  const res = await authFetch(`/api/orders/${id}/`);
  if (!res.ok) throw new Error("No se pudo cargar el pedido.");
  return res.json();
}
