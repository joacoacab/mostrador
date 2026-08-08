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

function textMessage(text: string, usage = { input_tokens: 1, output_tokens: 1 }): Anthropic.Message {
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

function toolUseMessage(
  name: string,
  input: unknown,
  id = "toolu_1",
  usage = { input_tokens: 1, output_tokens: 1 },
): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "tool_use", id, name, input }],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: usage as Anthropic.Usage,
  } as Anthropic.Message;
}

describe("runAgent", () => {
  const ctx = {
    orderCore: createOrderCoreClient({ baseUrl: "http://order-core.local", botToken: "test-bot-token" }),
    customerPhone: "5491122334455@c.us",
  };

  it("responde directo si Claude no pide ninguna tool real (via sin_accion)", async () => {
    const client = fakeClient(toolUseMessage("sin_accion", {}), textMessage("Hola! ¿En qué te puedo ayudar?"));

    const reply = await runAgent("hola", ctx, { client });

    expect(reply).toBe("Hola! ¿En qué te puedo ayudar?");
  });

  it("fuerza tool_choice=any en el primer turno para que no pueda confirmar una acción sin pasar por una tool (tarea 36)", async () => {
    const client = fakeClient(toolUseMessage("sin_accion", {}), textMessage("Listo."));

    await runAgent("cancelame el pedido", ctx, { client });

    const create = client.messages.create as ReturnType<typeof vi.fn>;
    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: "any" });
    expect(create.mock.calls[1][0].tool_choice).toEqual({ type: "auto" });
  });

  it("ejecuta ver_catalogo contra el Order Core y arma la respuesta final", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: 1, nombre: "Chipa", precio: "2500.00", unidad: "docena", disponible: true }]));

    const client = fakeClient(
      toolUseMessage("ver_catalogo", {}),
      textMessage("Tenemos Chipa a $2500 la docena."),
    );

    const reply = await runAgent("qué tienen?", ctx, { client });

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

    const reply = await runAgent("quiero 2 chipas", ctx, { client });

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

    const reply = await runAgent("qué tienen?", ctx, { client });

    expect(reply).toBe("No pude traer el catálogo ahora, probá en un rato.");
    const secondCallMessages = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[1][0].messages;
    const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(toolResultMsg.content[0].is_error).toBe(true);
  });

  it("ejecuta consultar_base_de_conocimiento con la pregunta del cliente (tarea 39, RAG)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: 1, contenido: "Aceptamos devoluciones con ticket dentro de los 10 días." }]));

    const client = fakeClient(
      toolUseMessage("consultar_base_de_conocimiento", { pregunta: "puedo devolver un producto?" }),
      textMessage("Sí, podés devolverlo con ticket dentro de los 10 días."),
    );

    const reply = await runAgent("puedo devolver un producto?", ctx, { client });

    expect(reply).toBe("Sí, podés devolverlo con ticket dentro de los 10 días.");
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/knowledge/search/?query=puedo%20devolver%20un%20producto%3F");
  });

  it("corta el loop y da una respuesta genérica si se pasa de MAX_TURNS", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const client = fakeClient(
      ...Array.from({ length: 10 }, () => toolUseMessage("ver_catalogo", {})),
    );

    const reply = await runAgent("hola", ctx, { client });

    expect(reply).toContain("no pude resolver");
  });

  it("ejecuta cancelar_pedido con el order_id y el teléfono del que escribe (tarea 36)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: 10,
        customer: 1,
        customer_nombre: "Cliente A",
        customer_telefono: ctx.customerPhone,
        canal: "whatsapp",
        estado: "cancelado",
        notas: "",
        created_at: "x",
        updated_at: "x",
        items: [],
      }),
    );

    const client = fakeClient(
      toolUseMessage("cancelar_pedido", { order_id: 10 }),
      textMessage("Listo, cancelé tu pedido."),
    );

    const reply = await runAgent("cancelame el pedido 10", ctx, { client });

    expect(reply).toBe("Listo, cancelé tu pedido.");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://order-core.local/api/orders/10/cancel/");
    expect(JSON.parse(init.body as string)).toEqual({ customer_phone: ctx.customerPhone });
  });

  it("manda el history (memoria corta, tarea 34) antes del mensaje nuevo", async () => {
    const client = fakeClient(textMessage("Sí, va la docena de chipa que pediste antes."));
    const history: Anthropic.MessageParam[] = [
      { role: "user", content: "quiero chipa" },
      { role: "assistant", content: "¿Cuántas docenas?" },
    ];

    await runAgent("dame 2", ctx, { client, history });

    const sentMessages = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0].messages;
    expect(sentMessages).toEqual([...history, { role: "user", content: "dame 2" }]);
  });

  it("loguea el costo acumulado de todos los turnos, asociado al teléfono (tarea 37)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const client = fakeClient(
      toolUseMessage("ver_catalogo", {}, "toolu_1", { input_tokens: 100, output_tokens: 20 }),
      textMessage("Tenemos Chipa a $2500 la docena.", { input_tokens: 150, output_tokens: 15 }),
    );

    await runAgent("qué tienen?", ctx, { client });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`telefono=${ctx.customerPhone}`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("input_tokens=250"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("output_tokens=35"));
    logSpy.mockRestore();
  });
});
