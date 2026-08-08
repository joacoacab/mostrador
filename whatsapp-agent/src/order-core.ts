export interface OrderCoreConfig {
  baseUrl: string;
  botToken: string;
}

export interface Product {
  id: number;
  nombre: string;
  precio: string;
  unidad: string;
  disponible: boolean;
  origen: string;
  external_id: string | null;
}

export interface TenantInfo {
  nombre: string;
  horarios: string;
  ubicacion: string;
  medios_pago: string;
}

export interface Customer {
  id: number;
  telefono: string;
  nombre: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  product: number;
  product_nombre: string;
  cantidad: string;
  precio_unitario_snapshot: string;
}

export interface Order {
  id: number;
  customer: number;
  customer_nombre: string;
  customer_telefono: string;
  canal: string;
  estado: string;
  notas: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface CreateOrderInput {
  customer: number;
  notas?: string;
  items: { product: number; cantidad: string }[];
}

export interface OrderCoreClient {
  getCatalog(): Promise<Product[]>;
  getTenantInfo(): Promise<TenantInfo>;
  findCustomerByPhone(telefono: string): Promise<Customer | null>;
  createCustomer(telefono: string, nombre: string): Promise<Customer>;
  findOrCreateCustomer(telefono: string, nombre: string): Promise<Customer>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: number): Promise<Order>;
  getOrdersByCustomerPhone(telefono: string): Promise<Order[]>;
}

/** Habla con el Order Core autenticado como bot (tarea 25, header
 * `Authorization: BotToken <token>`) -- el bot puede leer catálogo/info y
 * crear/consultar pedidos, pero no cambiarles el estado (eso no es una tool
 * de la spec 4.1). */
export function createOrderCoreClient(config: OrderCoreConfig): OrderCoreClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `BotToken ${config.botToken}`,
        ...init?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Order Core ${init?.method ?? "GET"} ${path} falló: ${response.status} ${await response.text()}`,
      );
    }
    return response.json() as Promise<T>;
  }

  async function findCustomerByPhone(telefono: string): Promise<Customer | null> {
    const customers = await request<Customer[]>(`/api/customers/?telefono=${encodeURIComponent(telefono)}`);
    return customers[0] ?? null;
  }

  function createCustomer(telefono: string, nombre: string): Promise<Customer> {
    return request<Customer>("/api/customers/", { method: "POST", body: JSON.stringify({ telefono, nombre }) });
  }

  return {
    getCatalog: () => request<Product[]>("/api/catalog/"),
    getTenantInfo: () => request<TenantInfo>("/api/tenant-info/"),
    findCustomerByPhone,
    createCustomer,
    async findOrCreateCustomer(telefono, nombre) {
      const existing = await findCustomerByPhone(telefono);
      return existing ?? createCustomer(telefono, nombre);
    },
    createOrder: (input) =>
      request<Order>("/api/orders/", { method: "POST", body: JSON.stringify({ ...input, canal: "whatsapp" }) }),
    getOrder: (id) => request<Order>(`/api/orders/${id}/`),
    getOrdersByCustomerPhone: (telefono) =>
      request<Order[]>(`/api/orders/?customer_phone=${encodeURIComponent(telefono)}`),
  };
}

/** Instancia real, leyendo la config del entorno (ORDER_CORE_URL,
 * ORDER_CORE_BOT_TOKEN) -- se resuelve en cada llamado, no en el import,
 * mismo criterio que `getActiveProvider()` en `providers/registry.ts`. */
export function getOrderCoreClient(): OrderCoreClient {
  return createOrderCoreClient({
    baseUrl: process.env.ORDER_CORE_URL ?? "http://localhost:8000",
    botToken: process.env.ORDER_CORE_BOT_TOKEN ?? "",
  });
}
