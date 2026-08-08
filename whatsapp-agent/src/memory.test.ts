import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { appendTurn, getHistory } from "./memory.js";
import type { ConversationMessage, ConversationState, OrderCoreClient } from "./order-core.js";

/** Order Core falso en memoria, suficiente para probar la lógica de
 * resumen/estado sin pegarle a Django -- replica el mismo contrato que
 * el endpoint real (solo devuelve mensajes con id > resumido_hasta_id). */
function fakeOrderCore(): OrderCoreClient {
  const conversations = new Map<string, { resumen: string; resumidoHastaId: number | null; mensajes: ConversationMessage[] }>();
  let nextId = 1;

  function getOrCreate(phone: string) {
    let conv = conversations.get(phone);
    if (!conv) {
      conv = { resumen: "", resumidoHastaId: null, mensajes: [] };
      conversations.set(phone, conv);
    }
    return conv;
  }

  function toState(phone: string): ConversationState {
    const conv = getOrCreate(phone);
    const mensajes = conv.resumidoHastaId === null ? conv.mensajes : conv.mensajes.filter((m) => m.id > conv.resumidoHastaId!);
    return { id: 1, estado: "activa", resumen: conv.resumen, mensajes };
  }

  return {
    getCatalog: () => Promise.reject(new Error("no implementado en el fake")),
    getTenantInfo: () => Promise.reject(new Error("no implementado en el fake")),
    findCustomerByPhone: () => Promise.reject(new Error("no implementado en el fake")),
    createCustomer: () => Promise.reject(new Error("no implementado en el fake")),
    findOrCreateCustomer: () => Promise.reject(new Error("no implementado en el fake")),
    createOrder: () => Promise.reject(new Error("no implementado en el fake")),
    getOrder: () => Promise.reject(new Error("no implementado en el fake")),
    getOrdersByCustomerPhone: () => Promise.reject(new Error("no implementado en el fake")),
    cancelOrder: () => Promise.reject(new Error("no implementado en el fake")),
    searchKnowledge: () => Promise.reject(new Error("no implementado en el fake")),
    getConversation: (phone) => Promise.resolve(toState(phone)),
    appendMessage: (phone, role, content) => {
      const conv = getOrCreate(phone);
      conv.mensajes.push({ id: nextId++, role, content, created_at: "x" });
      return Promise.resolve(toState(phone));
    },
    updateConversationSummary: (phone, resumen, resumidoHasta) => {
      const conv = getOrCreate(phone);
      conv.resumen = resumen;
      conv.resumidoHastaId = resumidoHasta;
      return Promise.resolve(toState(phone));
    },
  };
}

function textMessage(text: string, usage = { input_tokens: 10, output_tokens: 5 }): Anthropic.Message {
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

function fakeAnthropicClient(...responses: Anthropic.Message[]): Pick<Anthropic, "messages"> {
  const create = vi.fn();
  for (const response of responses) create.mockResolvedValueOnce(response);
  return { messages: { create } as unknown as Anthropic["messages"] };
}

describe("memoria de conversación (Order Core, tarea 40)", () => {
  it("no hay historial para un teléfono nuevo", async () => {
    const orderCore = fakeOrderCore();
    const history = await getHistory(orderCore, "telefono-nuevo");
    expect(history).toEqual([]);
  });

  it("acumula turnos en orden y los devuelve como user/assistant, sin resumen todavía", async () => {
    const orderCore = fakeOrderCore();
    const phone = "telefono-turnos";

    await appendTurn(orderCore, phone, "quiero chipa", "¿Cuántas docenas?");
    await appendTurn(orderCore, phone, "dame 2", "Listo, pedido confirmado.");

    const history = await getHistory(orderCore, phone);
    expect(history).toEqual([
      { role: "user", content: "quiero chipa" },
      { role: "assistant", content: "¿Cuántas docenas?" },
      { role: "user", content: "dame 2" },
      { role: "assistant", content: "Listo, pedido confirmado." },
    ]);
  });

  it("al superar el umbral, resume los mensajes viejos y deja los últimos verbatim", async () => {
    const orderCore = fakeOrderCore();
    const phone = "telefono-resumen";
    const client = fakeAnthropicClient(textMessage("El cliente pidió varias cosas de chipa a lo largo de la charla."));

    // 11 turnos (22 mensajes) -- supera el umbral de 20.
    for (let i = 0; i < 11; i++) {
      await appendTurn(orderCore, phone, `mensaje ${i}`, `respuesta ${i}`, { client });
    }

    expect(client.messages.create).toHaveBeenCalledTimes(1);
    const history = await getHistory(orderCore, phone);
    expect(history[0]).toEqual({
      role: "user",
      content: "[Resumen de la conversación hasta acá, para tener contexto: El cliente pidió varias cosas de chipa a lo largo de la charla.]",
    });
    expect(history[1]).toEqual({ role: "assistant", content: "Entendido, sigo desde ahí." });
    // KEEP_VERBATIM = 6 mensajes sin resumir, después del resumen + su ack.
    expect(history).toHaveLength(2 + 6);
    expect(history[history.length - 1]).toEqual({ role: "assistant", content: "respuesta 10" });
  });

  it("no vuelve a resumir si todavía no se juntaron suficientes mensajes nuevos", async () => {
    const orderCore = fakeOrderCore();
    const phone = "telefono-sin-resumen-todavia";
    const client = fakeAnthropicClient();

    for (let i = 0; i < 5; i++) {
      await appendTurn(orderCore, phone, `mensaje ${i}`, `respuesta ${i}`, { client });
    }

    expect(client.messages.create).not.toHaveBeenCalled();
  });
});
