import Anthropic from "@anthropic-ai/sdk";

import type { AgentContext, RunAgentOptions } from "./agent.js";
import { runAgent } from "./agent.js";
import { logUsage } from "./cost.js";

const ROUTER_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

const ROUTER_SYSTEM_PROMPT = `Clasificá el mensaje de un cliente de WhatsApp a un comercio en una sola categoría. Respondé SOLO con la palabra de la categoría, nada más, sin puntuación ni explicación:

- info_local: el mensaje pregunta únicamente por horarios, ubicación o medios de pago del comercio. No aplica si además pide, cancela o consulta un pedido, o si mezcla la pregunta con cualquier otra cosa.
- otro: cualquier otro caso -- pedidos, catálogo, cancelaciones, consultar el estado de un pedido, saludos, charla, o cualquier mensaje ambiguo.

Ante la duda, respondé "otro".`;

type Route = "info_local" | "otro";

/** Llamado barato (spec de la capa de IA, tarea 38) que decide si hace
 * falta el loop completo de tool-use de `runAgent` o si alcanza con una
 * respuesta directa. Sin tools y con `max_tokens` chico -- por diseño no
 * ve el historial de la conversación, solo el mensaje actual, así que
 * cualquier caso con contexto ambiguo cae en "otro" (el criterio "ante
 * la duda, otro" del prompt es la red de seguridad para eso). */
async function classify(text: string, customerPhone: string, client: Pick<Anthropic, "messages">): Promise<Route> {
  const response = await client.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 10,
    system: ROUTER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });
  logUsage(customerPhone, "router", ROUTER_MODEL, response.usage.input_tokens, response.usage.output_tokens);

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
  return raw === "info_local" ? "info_local" : "otro";
}

/** Punto de entrada real del bot (reemplaza a `runAgent` como lo que llama
 * el worker): clasifica primero y, si el mensaje es una consulta simple de
 * info_local, responde directo con los datos del tenant sin pasar por el
 * modelo principal ni sus tools -- ahí es donde se ahorran los tokens del
 * loop completo (visible comparando el log de costo por etapa, tarea 37). */
export async function respond(text: string, ctx: AgentContext, options: RunAgentOptions = {}): Promise<string> {
  const client = options.client ?? new Anthropic();
  const route = await classify(text, ctx.customerPhone, client);

  if (route === "info_local") {
    const info = await ctx.orderCore.getTenantInfo();
    return `Horarios: ${info.horarios}\nUbicación: ${info.ubicacion}\nMedios de pago: ${info.medios_pago}`;
  }

  return runAgent(text, ctx, { ...options, client });
}
