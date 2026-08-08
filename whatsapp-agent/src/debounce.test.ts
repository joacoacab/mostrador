import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce } from "./debounce.js";
import type { IncomingMessage } from "./providers/types.js";

function message(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    from: "5491122334455@c.us",
    text: "hola",
    providerMessageId: "id-1",
    timestamp: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.WHATSAPP_PROVIDER = "waha";
    process.env.WAHA_API_KEY = "test-key";
    // Mockeado siempre, no solo en el test que lo verifica -- flush() corre
    // dentro de un setTimeout con fake timers, así que su fetch real
    // completaría en tiempo de reloj real y podía terminar atribuido al
    // siguiente test en el reporte de vitest.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("no llama al handler real hasta que pasa la ventana de espera", async () => {
    const handler = vi.fn().mockResolvedValue("respuesta");
    const debounced = debounce(handler, 6000);

    const reply = await debounced(message());

    expect(reply).toBe("");
    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(6000);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("junta varios mensajes seguidos del mismo remitente en un solo texto", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    const debounced = debounce(handler, 6000);

    await debounced(message({ text: "quiero" }));
    await vi.advanceTimersByTimeAsync(2000);
    await debounced(message({ text: "2 chipas" }));
    await vi.advanceTimersByTimeAsync(6000);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].text).toBe("quiero\n2 chipas");
  });

  it("resetea la ventana con cada mensaje nuevo -- no dispara antes de tiempo", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    const debounced = debounce(handler, 6000);

    await debounced(message({ text: "a" }));
    await vi.advanceTimersByTimeAsync(5000);
    await debounced(message({ text: "b" }));
    await vi.advanceTimersByTimeAsync(5000); // 10s desde el primero, pero solo 5s desde el segundo

    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("manda la respuesta del handler por el proveedor activo cuando se cumple la ventana", async () => {
    const handler = vi.fn().mockResolvedValue("gracias por tu mensaje");
    const debounced = debounce(handler, 6000);

    await debounced(message());
    await vi.advanceTimersByTimeAsync(6000);
    const fetchSpy = vi.mocked(globalThis.fetch);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/sendText");
    expect(JSON.parse(init.body as string)).toMatchObject({ text: "gracias por tu mensaje" });
  });

  it("no manda nada si el handler real devuelve vacío", async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    const handler = vi.fn().mockResolvedValue("");
    const debounced = debounce(handler, 6000);

    await debounced(message());
    await vi.advanceTimersByTimeAsync(6000);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("teléfonos distintos no se mezclan entre sí", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    const debounced = debounce(handler, 6000);

    await debounced(message({ from: "a@c.us", text: "de a" }));
    await debounced(message({ from: "b@c.us", text: "de b" }));
    await vi.advanceTimersByTimeAsync(6000);

    expect(handler).toHaveBeenCalledTimes(2);
    const texts = handler.mock.calls.map((call) => call[0].text).sort();
    expect(texts).toEqual(["de a", "de b"]);
  });
});
