import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

import type { OrderCoreClient } from "./order-core.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
const MAX_TURNS = 6;

const SYSTEM_PROMPT = `Sos el asistente de WhatsApp de un comercio. SOLO podés ayudar con estas cuatro cosas, usando siempre las tools -- nunca de memoria:
- ver el catálogo de productos disponibles
- hacer un pedido
- consultar el estado de sus pedidos
- responder preguntas sobre horarios, ubicación o medios de pago

Respondé siempre en español, corto y claro, como por WhatsApp -- sin markdown. No inventes productos, precios ni información que no salga de las tools.

No sos un asistente de propósito general: no respondas preguntas de cultura general, no charles de otros temas (películas, series, clima, noticias, etc.), ni uses tu conocimiento general para nada que no sea el comercio, aunque el mensaje se parezca por la palabra a alguna de tus cuatro tareas (ej. "capítulo" no es "catálogo"). Si el mensaje del cliente no es claramente sobre pedidos, catálogo, estado de un pedido o info del local, no intentes adivinar qué quiso decir ni respondas con otra cosa: decí que no entendiste y preguntá si quiere ver el catálogo, hacer un pedido, o consultar el estado de uno. Si de verdad no podés resolver lo que pide (algo fuera de estas cuatro cosas), decí que no podés ayudar con eso y que un operador del local se va a comunicar.`;

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
    default:
      throw new Error(`Tool desconocida: ${name}`);
  }
}

/** Loop manual de tool use (spec 4.1, tarea 33): manda el mensaje del
 * cliente, ejecuta las tools que Claude pida contra el Order Core, y
 * devuelve el texto final. `client` es inyectable para poder testear sin
 * pegarle a la API real; `history` es la memoria corta de la tarea 34
 * (turnos previos de la misma conversación, sin los tool_use intermedios --
 * esos ya se resolvieron, no hace falta que vuelvan a viajar). */
export interface RunAgentOptions {
  client?: Pick<Anthropic, "messages">;
  history?: MessageParam[];
}

export async function runAgent(text: string, ctx: AgentContext, options: RunAgentOptions = {}): Promise<string> {
  const client = options.client ?? new Anthropic();
  const messages: MessageParam[] = [...(options.history ?? []), { role: "user", content: text }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((block) => block.type === "text");
      return textBlock?.type === "text" ? textBlock.text : "";
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

  return "Perdón, no pude resolver tu pedido en este momento. En un rato te escribe alguien del local.";
}
