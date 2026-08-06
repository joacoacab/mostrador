/** Cola de Redis donde el webhook deja los mensajes normalizados y de
 * donde el worker (tarea 31) los va a consumir. */
export const INCOMING_MESSAGES_QUEUE = "whatsapp:incoming-messages";
