import { selectProvider, type ProviderRegistry } from "./select.js";
import type { WhatsAppProvider } from "./types.js";
import { createWahaProvider } from "./waha.js";

/** Adapters reales. Meta (tarea 30) todavía no está -- el resto del
 * servicio (webhook, worker) programa contra `WhatsAppProvider`, no
 * contra estos adapters concretos. */
const providers: ProviderRegistry = {
  waha: () =>
    createWahaProvider({
      baseUrl: process.env.WAHA_BASE_URL ?? "http://localhost:3001",
      apiKey: process.env.WAHA_API_KEY ?? "",
      session: process.env.WAHA_SESSION ?? "default",
    }),
};

/** Proveedor activo según `WHATSAPP_PROVIDER` (env var). */
export function getActiveProvider(): WhatsAppProvider {
  return selectProvider(process.env.WHATSAPP_PROVIDER, providers);
}
