/** Mensaje de texto entrante, en un formato común sin importar el
 * proveedor (WAHA, Meta Cloud API) que lo haya recibido. */
export interface IncomingMessage {
  /** Teléfono del cliente, tal como lo manda el proveedor (sin normalizar a E.164 todavía). */
  from: string;
  text: string;
  providerMessageId: string;
  timestamp: Date;
}

export interface WhatsAppProvider {
  readonly name: string;

  sendMessage(to: string, text: string): Promise<void>;

  /** Traduce el body crudo del webhook del proveedor a mensajes normalizados.
   * Puede devolver [] si el payload no trae mensajes de texto (ack, status, etc). */
  parseWebhookPayload(body: unknown): IncomingMessage[];

  /** Solo lo implementan proveedores con verificación de webhook por GET
   * (Meta, con hub.challenge). Devuelve el challenge a responder, o null si
   * la verificación falla. Un proveedor sin este método no soporta GET. */
  verifyWebhook?(query: Record<string, string>): string | null;
}
