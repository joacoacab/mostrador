import { INCOMING_MESSAGES_QUEUE } from "./constants.js";
import { getActiveProvider } from "./providers/registry.js";
import type { IncomingMessage } from "./providers/types.js";
import { dequeue } from "./queue.js";

/** Un handler puede devolver "" (o cualquier string falsy) para decir "todavía
 * no hay respuesta" -- lo usa `debounce()` (tarea 34), que agrupa mensajes
 * seguidos del mismo remitente y manda la respuesta real por su cuenta
 * cuando termina la ventana de espera, no en este mismo llamado. */
export type MessageHandler = (message: IncomingMessage) => Promise<string>;

interface ProcessOptions {
  queue?: string;
  timeoutSeconds?: number;
}

/** Saca un mensaje de la cola, lo procesa con `handler` y manda la
 * respuesta por el proveedor activo -- no sabe si es WAHA o Meta (tarea
 * 28). Devuelve false si no había ningún mensaje esperando. */
export async function processNextMessage(
  handler: MessageHandler,
  { queue = INCOMING_MESSAGES_QUEUE, timeoutSeconds = 5 }: ProcessOptions = {},
): Promise<boolean> {
  const raw = await dequeue<IncomingMessage>(queue, timeoutSeconds);
  if (!raw) {
    return false;
  }
  // dequeue hace JSON.parse -- `timestamp` vuelve como string, no Date.
  const message: IncomingMessage = { ...raw, timestamp: new Date(raw.timestamp) };

  const reply = await handler(message);
  if (reply) {
    await getActiveProvider().sendMessage(message.from, reply);
  }
  return true;
}

/** Loop infinito: un mensaje mal formado o un error del handler no debe
 * tirar abajo el worker entero, solo se loguea y se sigue con el próximo. */
export async function runWorker(handler: MessageHandler, queue = INCOMING_MESSAGES_QUEUE): Promise<never> {
  for (;;) {
    try {
      await processNextMessage(handler, { queue });
    } catch (err) {
      console.error("Error procesando mensaje de la cola", err);
    }
  }
}
