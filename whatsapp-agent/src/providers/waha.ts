import type { IncomingMessage, WhatsAppProvider } from "./types.js";

export interface WahaConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
}

interface WahaWebhookBody {
  event?: string;
  payload?: {
    id?: string;
    timestamp?: number;
    from?: string;
    body?: string;
    fromMe?: boolean;
  };
}

/** WAHA identifica contactos como "<id>@c.us" o, cuando el remitente tiene
 * activada la privacidad de número (frecuente entre cuentas Business),
 * como "<id>@lid" -- un identificador que NO es el teléfono real. Guardamos
 * el chatId completo tal cual en `from` (sin separar el sufijo) porque es
 * lo único que WAHA acepta de vuelta en `sendMessage` para contestarle a
 * ese remitente en particular. No manda audio en esta fase (spec 4.2, Fase
 * 3), así que solo nos importan mensajes de texto propios del cliente (no
 * eventos `fromMe`, no acks). */
export function createWahaProvider(config: WahaConfig): WhatsAppProvider {
  return {
    name: "waha",

    async sendMessage(to, text) {
      const response = await fetch(`${config.baseUrl}/api/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": config.apiKey,
        },
        body: JSON.stringify({ chatId: toChatId(to), text, session: config.session }),
      });
      if (!response.ok) {
        throw new Error(`WAHA sendText falló: ${response.status} ${await response.text()}`);
      }
    },

    parseWebhookPayload(body): IncomingMessage[] {
      const event = body as WahaWebhookBody;
      const payload = event.event === "message" ? event.payload : undefined;
      if (!payload || payload.fromMe) {
        return [];
      }
      const { id, timestamp, from, body: text } = payload;
      if (!id || !from || typeof text !== "string" || typeof timestamp !== "number") {
        return [];
      }
      return [{ from, text, providerMessageId: id, timestamp: new Date(timestamp * 1000) }];
    },
  };
}

function toChatId(phone: string): string {
  return phone.includes("@") ? phone : `${phone}@c.us`;
}
