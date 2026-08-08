import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { createOrderCoreClient } from "./order-core.js";
import { respond } from "./router.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fakeClient(...responses: Anthropic.Message[]): Pick<Anthropic, "messages"> {
  const create = vi.fn();
  for (const response of responses) create.mockResolvedValueOnce(response);
  return { messages: { create } as unknown as Anthropic["messages"] };
}

function textMessage(text: string, usage = { input_tokens: 10, output_tokens: 2 }): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: usage as Anthropic.Usage,
  } as Anthropic.Message;
}

function toolUseMessage(name: string, input: unknown, id = "toolu_1"): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "tool_use", id, name, input }],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20 } as Anthropic.Usage,
  } as Anthropic.Message;
}

describe("respond (router)", () => {
  const ctx = {
    orderCore: createOrderCoreClient({ baseUrl: "http://order-core.local", botToken: "test-bot-token" }),
    customerPhone: "5491122334455@c.us",
  };

  it("responde info_local directo, sin pasar por el loop de tools del modelo principal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ nombre: "Tenant A", horarios: "9 a 20", ubicacion: "Av. Siempre Viva 742", medios_pago: "Efectivo y transferencia" }),
    );
    const client = fakeClient(textMessage("info_local"));

    const reply = await respond("a qué hora abren?", ctx, { client });

    expect(reply).toContain("9 a 20");
    expect(reply).toContain("Av. Siempre Viva 742");
    const create = client.messages.create as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledTimes(1); // solo el clasificador, nunca el loop principal
    expect(create.mock.calls[0][0].tools).toBeUndefined();
  });

  it("cae en el loop completo de runAgent si la categoría es otro", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: 1, nombre: "Chipa", precio: "2500.00", unidad: "docena", disponible: true }]));
    const client = fakeClient(
      textMessage("otro"), // clasificador
      toolUseMessage("ver_catalogo", {}), // runAgent turno 0
      textMessage("Tenemos Chipa a $2500 la docena."), // runAgent turno 1
    );

    const reply = await respond("qué productos tienen?", ctx, { client });

    expect(reply).toBe("Tenemos Chipa a $2500 la docena.");
    expect(fetchSpy).toHaveBeenCalledWith("http://order-core.local/api/catalog/", expect.anything());
  });

  it("ante una respuesta ambigua del clasificador, cae en otro (red de seguridad)", async () => {
    const client = fakeClient(
      textMessage("no estoy seguro"), // clasificador responde algo raro
      toolUseMessage("sin_accion", {}), // runAgent turno 0 (tool_choice=any forzado, tarea 36)
      textMessage("Hola! ¿En qué te ayudo?"), // runAgent turno 1
    );

    const reply = await respond("hmm", ctx, { client });

    expect(reply).toBe("Hola! ¿En qué te ayudo?");
  });
});
