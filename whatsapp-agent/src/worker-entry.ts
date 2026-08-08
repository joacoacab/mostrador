import "dotenv/config";

import type { IncomingMessage } from "./providers/types.js";
import { runWorker } from "./worker.js";

/** Placeholder hasta la tarea 33 (agente con Claude, tool use). Por ahora
 * el worker solo confirma que el mensaje llegó -- prueba el loop completo
 * (cola -> handler -> respuesta por el proveedor activo) sin tener
 * todavía agente, cliente del Order Core ni memoria. */
async function placeholderHandler(message: IncomingMessage): Promise<string> {
  return `Recibimos tu mensaje: "${message.text}". Todavía no puedo armar pedidos solo -- en un rato lo resuelve alguien del local.`;
}

console.log("whatsapp-agent worker arrancando...");

runWorker(placeholderHandler).catch((err: unknown) => {
  console.error("Worker terminó con un error fatal", err);
  process.exit(1);
});
