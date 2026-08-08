import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

import { logUsage } from "./cost.js";
import type { OrderCoreClient } from "./order-core.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

/** Mensajes sin resumir a partir de los cuales se dispara un resumen nuevo
 * (spec de la capa de IA, tarea 40) -- reemplaza la memoria en Redis de la
 * tarea 34 (ventana fija de últimos N turnos, sin resumen). */
const SUMMARIZE_THRESHOLD = 20;
/** Mensajes recientes que se dejan siempre sin resumir, verbatim. */
const KEEP_VERBATIM = 6;

const SUMMARIZE_SYSTEM_PROMPT = `Resumí esta conversación entre un cliente y el bot de WhatsApp de un comercio, en un párrafo corto en español. Incluí los datos concretos que hagan falta para seguir atendiendo (pedidos mencionados con número si lo hay, preferencias del cliente, qué quedó pendiente). No inventes nada que no esté en la conversación. Devolvé solo el resumen, sin introducción.`;

/** Arma el history para mandarle a runAgent: el resumen corriente (si hay)
 * como contexto previo, más los mensajes que todavía no se plegaron ahí. */
export async function getHistory(orderCore: OrderCoreClient, phone: string): Promise<MessageParam[]> {
  const conversation = await orderCore.getConversation(phone);
  const verbatim: MessageParam[] = conversation.mensajes.map((m) => ({ role: m.role, content: m.content }));

  if (!conversation.resumen) {
    return verbatim;
  }
  return [
    { role: "user", content: `[Resumen de la conversación hasta acá, para tener contexto: ${conversation.resumen}]` },
    { role: "assistant", content: "Entendido, sigo desde ahí." },
    ...verbatim,
  ];
}

export interface AppendTurnOptions {
  client?: Pick<Anthropic, "messages">;
}

/** Guarda el turno (mensaje del cliente + respuesta del bot) en el Order
 * Core y, si ya se juntaron demasiados mensajes sin resumir, pliega los
 * más viejos en el resumen corriente de la conversación -- así no hay que
 * reenviar todo el historial en cada turno (tarea 40). */
export async function appendTurn(
  orderCore: OrderCoreClient,
  phone: string,
  userText: string,
  assistantText: string,
  options: AppendTurnOptions = {},
): Promise<void> {
  await orderCore.appendMessage(phone, "user", userText);
  const conversation = await orderCore.appendMessage(phone, "assistant", assistantText);

  if (conversation.mensajes.length <= SUMMARIZE_THRESHOLD) {
    return;
  }

  const toFold = conversation.mensajes.slice(0, conversation.mensajes.length - KEEP_VERBATIM);
  const client = options.client ?? new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SUMMARIZE_SYSTEM_PROMPT,
    messages: [
      ...(conversation.resumen
        ? [{ role: "user" as const, content: `Resumen previo: ${conversation.resumen}` }]
        : []),
      {
        role: "user",
        content: toFold.map((m) => `${m.role === "user" ? "Cliente" : "Bot"}: ${m.content}`).join("\n"),
      },
    ],
  });
  logUsage(phone, "resumen", MODEL, response.usage.input_tokens, response.usage.output_tokens);

  const textBlock = response.content.find((block) => block.type === "text");
  const nuevoResumen = textBlock?.type === "text" ? textBlock.text : conversation.resumen;
  const lastFoldedId = toFold[toFold.length - 1].id;

  await orderCore.updateConversationSummary(phone, nuevoResumen, lastFoldedId);
}
