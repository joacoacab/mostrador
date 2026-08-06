import { afterEach, describe, expect, it, vi } from "vitest";

import { createWahaProvider } from "./waha.js";

describe("WAHA adapter", () => {
  const provider = createWahaProvider({ baseUrl: "http://waha.local", apiKey: "test-key", session: "default" });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parsea un mensaje entrante real de WAHA", () => {
    const messages = provider.parseWebhookPayload({
      event: "message",
      session: "default",
      engine: "WEBJS",
      payload: {
        id: "true_5491122334455@c.us_ABC123",
        timestamp: 1700000000,
        from: "5491122334455@c.us",
        to: "5491100000000@c.us",
        body: "hola quiero hacer un pedido",
        fromMe: false,
        hasMedia: false,
        ack: 1,
      },
    });

    expect(messages).toEqual([
      {
        from: "5491122334455@c.us",
        text: "hola quiero hacer un pedido",
        providerMessageId: "true_5491122334455@c.us_ABC123",
        timestamp: new Date(1700000000 * 1000),
      },
    ]);
  });

  it("preserva el chatId completo cuando el remitente usa @lid (privacidad de número)", () => {
    const messages = provider.parseWebhookPayload({
      event: "message",
      payload: {
        id: "false_227525993230430@lid_ABC",
        timestamp: 1700000000,
        from: "227525993230430@lid",
        body: "hola",
        fromMe: false,
      },
    });

    expect(messages[0]?.from).toBe("227525993230430@lid");
  });

  it("ignora eventos que no son de mensaje", () => {
    expect(provider.parseWebhookPayload({ event: "message.ack", payload: {} })).toEqual([]);
  });

  it("ignora mensajes propios (fromMe)", () => {
    const messages = provider.parseWebhookPayload({
      event: "message",
      payload: { id: "x", timestamp: 1, from: "a@c.us", body: "eco", fromMe: true },
    });
    expect(messages).toEqual([]);
  });

  it("ignora payloads incompletos en vez de romper", () => {
    expect(provider.parseWebhookPayload({ event: "message", payload: { fromMe: false } })).toEqual([]);
  });

  it("no implementa verifyWebhook -- WAHA no tiene verificación por GET", () => {
    expect(provider.verifyWebhook).toBeUndefined();
  });

  it("sendMessage llama a POST /api/sendText con el chatId armado", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await provider.sendMessage("5491122334455", "gracias por tu pedido");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://waha.local/api/sendText");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
    expect(JSON.parse(init.body as string)).toEqual({
      chatId: "5491122334455@c.us",
      text: "gracias por tu pedido",
      session: "default",
    });
  });

  it("tira un error legible si WAHA responde con error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(provider.sendMessage("5491122334455", "hola")).rejects.toThrow(/500/);
  });
});
