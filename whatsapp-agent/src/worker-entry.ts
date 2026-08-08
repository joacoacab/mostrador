import "dotenv/config";

import { runAgent } from "./agent.js";
import { getOrderCoreClient } from "./order-core.js";
import type { IncomingMessage } from "./providers/types.js";
import { runWorker } from "./worker.js";

/** El fallback genérico "de verdad" (mensaje + log estructurado) es la
 * tarea 35 -- este catch es solo para que un error del agente no tire
 * abajo el worker ni deje al cliente sin respuesta. */
async function handleMessage(message: IncomingMessage): Promise<string> {
  try {
    return await runAgent(message.text, { orderCore: getOrderCoreClient(), customerPhone: message.from });
  } catch (err) {
    console.error("Error en el agente", err);
    return "Uy, no pude procesar tu mensaje. En un rato te escribe alguien del local.";
  }
}

console.log("whatsapp-agent worker arrancando...");

runWorker(handleMessage).catch((err: unknown) => {
  console.error("Worker terminó con un error fatal", err);
  process.exit(1);
});
