import type { WhatsAppProvider } from "./types.js";

export type ProviderRegistry = Record<string, () => WhatsAppProvider>;

/** Elige el adapter activo por nombre. Recibe el registry como parámetro
 * (en vez de importarlo fijo) para poder testear la selección sin depender
 * de qué adapters concretos existan en un momento dado. */
export function selectProvider(name: string | undefined, registry: ProviderRegistry): WhatsAppProvider {
  if (!name) {
    throw new Error("Falta la variable de entorno WHATSAPP_PROVIDER.");
  }
  const factory = registry[name];
  if (!factory) {
    const disponibles = Object.keys(registry).join(", ") || "(ninguno todavía)";
    throw new Error(`Proveedor de WhatsApp desconocido: "${name}". Disponibles: ${disponibles}.`);
  }
  return factory();
}
