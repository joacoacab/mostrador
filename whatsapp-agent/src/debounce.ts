import { getActiveProvider } from "./providers/registry.js";
import type { IncomingMessage } from "./providers/types.js";
import type { MessageHandler } from "./worker.js";

const DEBOUNCE_MS = Number(process.env.MESSAGE_DEBOUNCE_MS ?? 6000);

interface PendingBatch {
  messages: IncomingMessage[];
  timer: ReturnType<typeof setTimeout>;
}

/** Junta mensajes seguidos del mismo remitente (es común que alguien mande
 * una idea en 2-3 mensajes cortos por WhatsApp en vez de uno solo) antes de
 * invocar al handler real -- evita que el bot conteste a mitad de frase.
 *
 * Buffer en memoria del proceso, no en Redis: alcanza con un solo worker
 * (no hay réplicas todavía, ver tarea 36); si el proceso muere a mitad de
 * la ventana, el peor caso es que el cliente no recibe respuesta y vuelve
 * a escribir, no una respuesta incorrecta.
 *
 * El handler que se le pasa a `debounce` sí manda la respuesta (vía
 * `getActiveProvider().sendMessage`), no la devuelve -- el `MessageHandler`
 * que devuelve `debounce()` siempre resuelve "" para que `processNextMessage`
 * no mande nada por su cuenta (ver worker.ts). */
export function debounce(handler: MessageHandler, windowMs = DEBOUNCE_MS): MessageHandler {
  const pending = new Map<string, PendingBatch>();

  return async (message) => {
    const existing = pending.get(message.from);
    if (existing) clearTimeout(existing.timer);
    const messages = existing ? [...existing.messages, message] : [message];

    const timer = setTimeout(() => {
      pending.delete(message.from);
      void flush(message.from, messages, handler);
    }, windowMs);

    pending.set(message.from, { messages, timer });
    return "";
  };
}

async function flush(from: string, messages: IncomingMessage[], handler: MessageHandler): Promise<void> {
  const combined: IncomingMessage = { ...messages[messages.length - 1], text: messages.map((m) => m.text).join("\n") };
  try {
    const reply = await handler(combined);
    if (reply) {
      await getActiveProvider().sendMessage(from, reply);
    }
  } catch (err) {
    console.error("Error procesando mensajes agrupados", err);
  }
}
