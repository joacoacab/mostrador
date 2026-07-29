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
  product_nombre: string;
  cantidad: string;
  precio_unitario_snapshot: string;
};

export type Estado =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "listo"
  | "en_camino"
  | "entregado"
  | "cancelado"
  | "sin_stock"
  | "rechazado";

export type Order = {
  id: number;
  customer: number;
  customer_nombre: string;
  customer_telefono: string;
  canal: "whatsapp" | "manual";
  estado: Estado;
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

export type OrderFilters = {
  canal?: string;
  customer_phone?: string;
  fecha?: string;
};

export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filters.canal) params.set("canal", filters.canal);
  if (filters.customer_phone) params.set("customer_phone", filters.customer_phone);
  if (filters.fecha) params.set("fecha", filters.fecha);
  const qs = params.toString();

  const res = await authFetch(`/api/orders/${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("No se pudieron cargar los pedidos.");
  return res.json();
}

export async function updateOrderStatus(id: number, estado: Estado): Promise<Order> {
  const res = await authFetch(`/api/orders/${id}/status/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.estado ?? "No se pudo cambiar el estado del pedido.");
  }
  return res.json();
}
