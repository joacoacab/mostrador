import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

import { logUsage } from "./cost.js";
import type { OrderCoreClient } from "./order-core.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
const MAX_TURNS = 6;

const SYSTEM_PROMPT = `Sos el asistente de WhatsApp de un comercio. SOLO podés ayudar con estas cuatro cosas, usando siempre las tools -- nunca de memoria:
- ver el catálogo de productos disponibles
- hacer un pedido
- consultar el estado de sus pedidos
- responder preguntas sobre horarios, ubicación o medios de pago

También podés cancelar un pedido si el cliente lo pide, y responder preguntas sobre políticas o dudas frecuentes del comercio usando la tool de la base de conocimiento (no de memoria -- si la búsqueda no devuelve nada relevante, decí que no tenés esa información).

CRÍTICO: crear, cancelar o consultar un pedido son acciones reales sobre el comercio del cliente -- nunca digas que ya hiciste algo (creaste un pedido, lo cancelaste, etc.) sin haber llamado a la tool correspondiente en esta misma respuesta y haber recibido su resultado. No asumas el resultado de una acción por lo que ya se dijo antes en la conversación, aunque parezca obvio -- cada pedido de crear/cancelar/consultar necesita su propio llamado a la tool, siempre, sin excepción. Confirmarle algo al cliente que en realidad no pasó es peor que no responder.

Respondé siempre en español, corto y claro, como por WhatsApp -- sin markdown. No inventes productos, precios ni información que no salga de las tools.

No sos un asistente de propósito general: no respondas preguntas de cultura general, no charles de otros temas (películas, series, clima, noticias, etc.), ni uses tu conocimiento general para nada que no sea el comercio, aunque el mensaje se parezca por la palabra a alguna de tus tareas (ej. "capítulo" no es "catálogo"). Si el mensaje del cliente no es claramente sobre pedidos, catálogo, estado/cancelación de un pedido o info del local, no intentes adivinar qué quiso decir ni respondas con otra cosa: decí que no entendiste y preguntá qué necesita.

Si de verdad no podés resolver lo que pide -- algo fuera de todo esto, baja confianza tuya sobre qué hacer, o el cliente está molesto y pide hablar con una persona -- usá la tool escalar_a_humano. Igual que con crear/cancelar un pedido: nunca digas que derivaste la conversación sin haber llamado a esa tool. Después de llamarla, avisale al cliente que un operador se va a comunicar, sin cortar la conversación de forma abrupta.`;

const TOOLS: Tool[] = [
  {
    name: "ver_catalogo",
    description: "Devuelve el catálogo de productos disponibles del comercio, con id, nombre, precio y unidad.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "crear_pedido",
    description:
      "Crea un pedido para el cliente con los productos elegidos. Usar solo con ids de producto que salieron de ver_catalogo.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Productos del pedido.",
          items: {
            type: "object",
            properties: {
              product_id: { type: "integer", description: "Id del producto (de ver_catalogo)." },
              cantidad: { type: "string", description: 'Cantidad pedida, ej. "2".' },
            },
            required: ["product_id", "cantidad"],
          },
        },
        notas: { type: "string", description: "Notas opcionales del pedido." },
      },
      required: ["items"],
    },
  },
  {
    name: "consultar_pedidos",
    description: "Devuelve los pedidos del cliente que está escribiendo, con su estado actual.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "info_local",
    description: "Devuelve horarios, ubicación y medios de pago del comercio.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancelar_pedido",
    description:
      "Cancela un pedido del cliente que está escribiendo. Usar solo con un id que salió de consultar_pedidos -- no se puede cancelar un pedido ajeno ni uno que ya está en un estado terminal (entregado/cancelado/etc.).",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "integer", description: "Id del pedido a cancelar (de consultar_pedidos)." },
      },
      required: ["order_id"],
    },
  },
  {
    name: "sin_accion",
    description:
      "Usar cuando el mensaje del cliente no pide ninguna acción sobre el comercio (saludos, agradecimientos, charla que no encaja en ninguna otra tool). No hace nada -- después de llamarla podés responder libremente en texto.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_base_de_conocimiento",
    description:
      "Busca en el contenido estático cargado del comercio (políticas, preguntas frecuentes largas) para responder algo que no está en el catálogo, los pedidos, ni en horarios/ubicación/medios de pago. Si no devuelve nada relevante, no inventes la respuesta.",
    input_schema: {
      type: "object",
      properties: {
        pregunta: { type: "string", description: "La pregunta del cliente, tal cual, para buscarla." },
      },
      required: ["pregunta"],
    },
  },
  {
    name: "escalar_a_humano",
    description:
      "Deriva la conversación a un operador humano -- usar cuando no podés resolver lo que pide el cliente (fuera de alcance, baja confianza, o el cliente pide explícitamente hablar con una persona / está molesto).",
    input_schema: {
      type: "object",
      properties: {
        resumen: {
          type: "string",
          description: "Resumen corto (2-3 oraciones) de la conversación y qué necesita el cliente, para que el operador no tenga que releer todo el chat.",
        },
      },
      required: ["resumen"],
    },
  },
];

export interface AgentContext {
  orderCore: OrderCoreClient;
  customerPhone: string;
}

interface CrearPedidoInput {
  items: { product_id: number; cantidad: string }[];
  notas?: string;
}

async function executeTool(name: string, input: unknown, ctx: AgentContext): Promise<string> {
  switch (name) {
    case "ver_catalogo": {
      const products = await ctx.orderCore.getCatalog();
      return JSON.stringify(products.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, unidad: p.unidad })));
    }
    case "crear_pedido": {
      const { items, notas } = input as CrearPedidoInput;
      const customer = await ctx.orderCore.findOrCreateCustomer(ctx.customerPhone, "Cliente WhatsApp");
      const order = await ctx.orderCore.createOrder({
        customer: customer.id,
        notas,
        items: items.map((item) => ({ product: item.product_id, cantidad: item.cantidad })),
      });
      return JSON.stringify({ id: order.id, estado: order.estado, items: order.items });
    }
    case "consultar_pedidos": {
      const orders = await ctx.orderCore.getOrdersByCustomerPhone(ctx.customerPhone);
      return JSON.stringify(orders.map((o) => ({ id: o.id, estado: o.estado, created_at: o.created_at, items: o.items })));
    }
    case "info_local": {
      return JSON.stringify(await ctx.orderCore.getTenantInfo());
    }
    case "cancelar_pedido": {
      const { order_id: orderId } = input as { order_id: number };
      const order = await ctx.orderCore.cancelOrder(orderId, ctx.customerPhone);
      return JSON.stringify({ id: order.id, estado: order.estado });
    }
    case "sin_accion":
      return "";
    case "consultar_base_de_conocimiento": {
      const { pregunta } = input as { pregunta: string };
      const chunks = await ctx.orderCore.searchKnowledge(pregunta);
      return JSON.stringify(chunks.map((c) => c.contenido));
    }
    case "escalar_a_humano": {
      const { resumen } = input as { resumen: string };
      await ctx.orderCore.escalateConversation(ctx.customerPhone, resumen);
      return "ok";
    }
    default:
      throw new Error(`Tool desconocida: ${name}`);
  }
}

/** Loop manual de tool use (spec 4.1, tarea 33): manda el mensaje del
 * cliente, ejecuta las tools que Claude pida contra el Order Core, y
 * devuelve el texto final. `client` es inyectable para poder testear sin
 * pegarle a la API real; `history` es la memoria corta de la tarea 34
 * (turnos previos de la misma conversación, sin los tool_use intermedios --
 * esos ya se resolvieron, no hace falta que vuelvan a viajar). Al terminar
 * loguea el costo acumulado de todos los turnos de este mensaje (tarea 37). */
export interface RunAgentOptions {
  client?: Pick<Anthropic, "messages">;
  history?: MessageParam[];
}

export async function runAgent(text: string, ctx: AgentContext, options: RunAgentOptions = {}): Promise<string> {
  const client = options.client ?? new Anthropic();
  const messages: MessageParam[] = [...(options.history ?? []), { role: "user", content: text }];

  let inputTokens = 0;
  let outputTokens = 0;
  let reply = "Perdón, no pude resolver tu pedido en este momento. En un rato te escribe alguien del local.";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      tool_choice: turn === 0 ? { type: "any" } : { type: "auto" },
      messages,
    });

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((block) => block.type === "text");
      reply = textBlock?.type === "text" ? textBlock.text : "";
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const result = await executeTool(block.name, block.input, ctx);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: err instanceof Error ? err.message : String(err),
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  logUsage(ctx.customerPhone, "principal", MODEL, inputTokens, outputTokens);
  return reply;
}
