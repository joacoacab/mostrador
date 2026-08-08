import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeRedisClient } from "./redis.js";
import { enqueue } from "./queue.js";
import { processNextMessage } from "./worker.js";

describe("processNextMessage", () => {
  beforeEach(() => {
    process.env.WHATSAPP_PROVIDER = "waha";
    process.env.WAHA_API_KEY = "test-key";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await closeRedisClient();
  });

  it("devuelve false y no llama al handler si no hay mensajes", async () => {
    const handler = vi.fn();
    const queue = `test-worker-vacia-${Date.now()}`;

    const processed = await processNextMessage(handler, { queue, timeoutSeconds: 1 });

    expect(processed).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("procesa el mensaje con el handler y manda la respuesta por el proveedor activo", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const queue = `test-worker-mensaje-${Date.now()}`;
    await enqueue(queue, {
      from: "5491122334455@c.us",
      text: "hola",
      providerMessageId: "id-1",
      timestamp: new Date("2026-01-01T00:00:00Z"),
    });

    const handler = vi.fn().mockResolvedValue("gracias por tu mensaje");
    const processed = await processNextMessage(handler, { queue, timeoutSeconds: 5 });

    expect(processed).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const received = handler.mock.calls[0]?.[0];
    expect(received.text).toBe("hola");
    expect(received.timestamp).toBeInstanceOf(Date);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/sendText");
    expect(JSON.parse(init.body as string)).toMatchObject({
      chatId: "5491122334455@c.us",
      text: "gracias por tu mensaje",
    });
  });

  it("no manda nada si el handler devuelve una respuesta vacía (debounce, tarea 34)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const queue = `test-worker-vacio-${Date.now()}`;
    await enqueue(queue, {
      from: "5491122334455@c.us",
      text: "hola",
      providerMessageId: "id-buffered",
      timestamp: new Date(),
    });

    const handler = vi.fn().mockResolvedValue("");
    const processed = await processNextMessage(handler, { queue, timeoutSeconds: 5 });

    expect(processed).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no interrumpe el llamador si el handler tira un error -- lo propaga (runWorker es quien lo absorbe)", async () => {
    const queue = `test-worker-error-${Date.now()}`;
    await enqueue(queue, {
      from: "5491122334455@c.us",
      text: "hola",
      providerMessageId: "id-2",
      timestamp: new Date(),
    });

    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(processNextMessage(handler, { queue, timeoutSeconds: 5 })).rejects.toThrow("boom");
  });
});
