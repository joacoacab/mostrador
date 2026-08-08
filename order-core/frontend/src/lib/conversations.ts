import { authFetch } from "./auth";

export type ConversationEstado = "activa" | "requiere_atencion";

export type Conversation = {
  id: number;
  customer_phone: string;
  estado: ConversationEstado;
  resumen: string;
  last_message_at: string;
  created_at: string;
};

// Solo las escaladas (tarea 41) -- es lo único que el panel necesita
// mostrar por ahora, no hay vista de "todas las conversaciones".
export async function listEscalatedConversations(): Promise<Conversation[]> {
  const res = await authFetch("/api/conversations/?estado=requiere_atencion");
  if (!res.ok) throw new Error("No se pudieron cargar las conversaciones.");
  return res.json();
}

export async function resolveConversation(id: number): Promise<Conversation> {
  const res = await authFetch(`/api/conversations/${id}/resolver/`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo marcar la conversación como resuelta.");
  return res.json();
}
