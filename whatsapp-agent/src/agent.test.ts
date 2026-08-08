import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { runAgent } from "./agent.js";
import { createOrderCoreClient } from "./order-core.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fakeClient(...responses: Anthropic.Message[]): Pick<Anthropic, "messages"> {
  const create = vi.fn();
  for (const response of responses) create.mockResolvedValueOnce(response);
  return { messages: { create } as unknown as Anthropic["messages"] };
}

function textMessage(text: string): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Usage,
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
    usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Usage,
  } as Anthropic.Message;
}

describe("runAgent", () => {
  const ctx = {
    orderCore: createOrderCoreClient({ baseUrl: "http://order-core.local", botToken: "test-bot-token" }),
    customerPhone: "5491122334455@c.us",
  };

  it("responde directo si Claude no pide ninguna tool", async () => {
    const client = fakeClient(textMessage("Hola! ¿En qué te puedo ayudar?"));

    const reply = await runAgent("hola", ctx, client);

    expect(reply).toBe("Hola! ¿En qué te puedo ayudar?");
  });

  it("ejecuta ver_catalogo contra el Order Core y arma la respuesta final", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: 1, nombre: "Chipa", precio: "2500.00", unidad: "docena", disponible: true }]));

    const client = fakeClient(
      toolUseMessage("ver_catalogo", {}),
      textMessage("Tenemos Chipa a $2500 la docena."),
    );

    const reply = await runAgent("qué tienen?", ctx, client);

    expect(reply).toBe("Tenemos Chipa a $2500 la docena.");
    expect(fetchSpy).toHaveBeenCalledWith("http://order-core.local/api/catalog/", expect.anything());
  });

  it("crea el pedido con el teléfono/chatId del mensaje como identificador del cliente", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const path = String(url);
      if (path.includes("/api/customers/") && path.includes("telefono=")) {
        return Promise.resolve(jsonResponse([]));
      }
      if (path.endsWith("/api/customers/")) {
        return Promise.resolve(jsonResponse({ id: 9, telefono: ctx.customerPhone, nombre: "Cliente WhatsApp", created_at: "x" }));
      }
      if (path.endsWith("/api/orders/")) {
        return Promise.resolve(
          jsonResponse(
            {
              id: 5,
              customer: 9,
              customer_nombre: "Cliente WhatsApp",
              customer_telefono: ctx.customerPhone,
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
      }
      throw new Error(`unexpected fetch: ${path}`);
    });

    const client = fakeClient(
      toolUseMessage("crear_pedido", { items: [{ product_id: 1, cantidad: "2" }] }),
      textMessage("Listo, pedido confirmado."),
    );

    const reply = await runAgent("quiero 2 chipas", ctx, client);

    expect(reply).toBe("Listo, pedido confirmado.");
    const createCustomerCall = fetchSpy.mock.calls.find(([url, init]) => {
      const i = init as RequestInit | undefined;
      return String(url).endsWith("/api/customers/") && i?.method === "POST";
    });
    expect(createCustomerCall).toBeDefined();
    expect(JSON.parse((createCustomerCall?.[1] as RequestInit).body as string)).toEqual({
      telefono: ctx.customerPhone,
      nombre: "Cliente WhatsApp",
    });
  });

  it("si una tool tira error, lo manda como tool_result de error y sigue el loop", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));

    const client = fakeClient(
      toolUseMessage("ver_catalogo", {}),
      textMessage("No pude traer el catálogo ahora, probá en un rato."),
    );

    const reply = await runAgent("qué tienen?", ctx, client);

    expect(reply).toBe("No pude traer el catálogo ahora, probá en un rato.");
    const secondCallMessages = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[1][0].messages;
    const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(toolResultMsg.content[0].is_error).toBe(true);
  });

  it("corta el loop y da una respuesta genérica si se pasa de MAX_TURNS", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const client = fakeClient(
      ...Array.from({ length: 10 }, () => toolUseMessage("ver_catalogo", {})),
    );

    const reply = await runAgent("hola", ctx, client);

    expect(reply).toContain("no pude resolver");
  });
});
