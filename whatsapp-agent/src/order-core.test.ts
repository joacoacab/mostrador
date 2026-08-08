import { afterEach, describe, expect, it, vi } from "vitest";

import { createOrderCoreClient } from "./order-core.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("OrderCoreClient", () => {
  const client = createOrderCoreClient({ baseUrl: "http://order-core.local", botToken: "test-bot-token" });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("manda el header BotToken en cada request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));

    await client.getCatalog();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/catalog/");
    expect((init.headers as Record<string, string>).Authorization).toBe("BotToken test-bot-token");
  });

  it("getTenantInfo pega a /api/tenant-info/", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ nombre: "Tenant A", horarios: "9 a 18", ubicacion: "Acá", medios_pago: "Efectivo" }),
    );

    const info = await client.getTenantInfo();

    expect(info.horarios).toBe("9 a 18");
  });

  it("findCustomerByPhone devuelve null si no hay resultados", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));

    const customer = await client.findCustomerByPhone("+5491122334455");

    expect(customer).toBeNull();
  });

  it("findCustomerByPhone devuelve el primer resultado y filtra por querystring", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: 1, telefono: "+5491122334455", nombre: "Cliente A", created_at: "x" }]));

    const customer = await client.findCustomerByPhone("+5491122334455");

    expect(customer?.id).toBe(1);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/customers/?telefono=%2B5491122334455");
  });

  it("findOrCreateCustomer crea el cliente si no existe", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 2, telefono: "+5491122334455", nombre: "Nuevo", created_at: "x" }));

    const customer = await client.findOrCreateCustomer("+5491122334455", "Nuevo");

    expect(customer.id).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [, createInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(createInit.method).toBe("POST");
    expect(JSON.parse(createInit.body as string)).toEqual({ telefono: "+5491122334455", nombre: "Nuevo" });
  });

  it("findOrCreateCustomer no crea nada si el cliente ya existe", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: 1, telefono: "+5491122334455", nombre: "Cliente A", created_at: "x" }]));

    await client.findOrCreateCustomer("+5491122334455", "Cliente A");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("createOrder agrega canal=whatsapp automáticamente", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          id: 10,
          customer: 1,
          customer_nombre: "Cliente A",
          customer_telefono: "+5491122334455",
          canal: "whatsapp",
          estado: "pendiente",
          notas: "",
          created_at: "x",
          updated_at: "x",
          items: [],
        },
        201,
      ),
    );

    await client.createOrder({ customer: 1, items: [{ product: 5, cantidad: "2" }] });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/orders/");
    expect(JSON.parse(init.body as string)).toEqual({
      customer: 1,
      items: [{ product: 5, cantidad: "2" }],
      canal: "whatsapp",
    });
  });

  it("getOrdersByCustomerPhone filtra por customer_phone", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));

    await client.getOrdersByCustomerPhone("+5491122334455");

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/orders/?customer_phone=%2B5491122334455");
  });

  it("tira un error legible si el Order Core responde con error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no autorizado", { status: 401 }));

    await expect(client.getCatalog()).rejects.toThrow(/401/);
  });

  it("cancelOrder manda customer_phone para que el Order Core valide la pertenencia", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: 10,
        customer: 1,
        customer_nombre: "Cliente A",
        customer_telefono: "+5491122334455",
        canal: "whatsapp",
        estado: "cancelado",
        notas: "",
        created_at: "x",
        updated_at: "x",
        items: [],
      }),
    );

    const order = await client.cancelOrder(10, "+5491122334455");

    expect(order.estado).toBe("cancelado");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/orders/10/cancel/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ customer_phone: "+5491122334455" });
  });

  it("searchKnowledge manda la pregunta como query param (tarea 39, RAG)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: 1, contenido: "Política de cambios: 10 días con ticket." }]));

    const chunks = await client.searchKnowledge("cual es la politica de cambios?");

    expect(chunks).toEqual([{ id: 1, contenido: "Política de cambios: 10 días con ticket." }]);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/knowledge/search/?query=cual%20es%20la%20politica%20de%20cambios%3F");
  });
});
