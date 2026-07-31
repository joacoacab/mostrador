import { selectProvider, type ProviderRegistry } from "./select.js";
import type { WhatsAppProvider } from "./types.js";

/** Adapters reales. Vacío hasta las tareas 29 (WAHA) y 30 (Meta) -- el
 * resto del servicio (webhook, worker) programa contra `WhatsAppProvider`,
 * no contra estos adapters concretos. */
const providers: ProviderRegistry = {};

/** Proveedor activo según `WHATSAPP_PROVIDER` (env var). */
export function getActiveProvider(): WhatsAppProvider {
  return selectProvider(process.env.WHATSAPP_PROVIDER, providers);
}
