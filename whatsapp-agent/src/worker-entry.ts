import "dotenv/config";

import { debounce } from "./debounce.js";
import { appendTurn, getHistory } from "./memory.js";
import { getOrderCoreClient } from "./order-core.js";
import type { IncomingMessage } from "./providers/types.js";
import { respond } from "./router.js";
import { runWorker } from "./worker.js";

/** El fallback genérico "de verdad" (mensaje + log estructurado) es la
 * tarea 35 -- este catch es solo para que un error del agente no tire
 * abajo el worker ni deje al cliente sin respuesta. */
async function handleMessage(message: IncomingMessage): Promise<string> {
  try {
    const orderCore = getOrderCoreClient();
    const history = await getHistory(orderCore, message.from);
    const reply = await respond(message.text, { orderCore, customerPhone: message.from }, { history });
    await appendTurn(orderCore, message.from, message.text, reply);
    return reply;
  } catch (err) {
    console.error("Error en el agente", err);
    return "Uy, no pude procesar tu mensaje. En un rato te escribe alguien del local.";
  }
}

console.log("whatsapp-agent worker arrancando...");

runWorker(debounce(handleMessage)).catch((err: unknown) => {
  console.error("Worker terminó con un error fatal", err);
  process.exit(1);
});
