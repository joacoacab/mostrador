import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

import { getRedisClient } from "./redis.js";

const TTL_SECONDS = Number(process.env.MEMORY_TTL_SECONDS ?? 1800);
/** Pares user/assistant a conservar -- memoria *corta*, no historial completo. */
const MAX_TURNS = 10;

function key(phone: string): string {
  return `whatsapp:memory:${phone}`;
}

export async function getHistory(phone: string): Promise<MessageParam[]> {
  const client = await getRedisClient();
  const raw = await client.get(key(phone));
  return raw ? (JSON.parse(raw) as MessageParam[]) : [];
}

/** Agrega el turno (mensaje del cliente + respuesta del bot) al final de la
 * memoria de ese teléfono, recorta a los últimos MAX_TURNS pares, y renueva
 * el TTL -- una conversación inactiva por TTL_SECONDS se olvida sola. */
export async function appendTurn(phone: string, userText: string, assistantText: string): Promise<void> {
  const client = await getRedisClient();
  const history = await getHistory(phone);
  history.push({ role: "user", content: userText }, { role: "assistant", content: assistantText });
  const trimmed = history.slice(-MAX_TURNS * 2);
  await client.set(key(phone), JSON.stringify(trimmed), { EX: TTL_SECONDS });
}
