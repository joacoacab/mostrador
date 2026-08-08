"use client";

import { useCallback, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { listEscalatedConversations, resolveConversation, type Conversation } from "@/lib/conversations";

const POLL_INTERVAL_MS = 5000;

export default function ConversacionesPage() {
  const [actionError, setActionError] = useState<string | null>(null);

  const fetcher = useCallback(() => listEscalatedConversations(), []);
  const { data: conversations, error, refetch } = usePolling<Conversation[]>(fetcher, POLL_INTERVAL_MS);

  async function handleResolve(id: number) {
    setActionError(null);
    try {
      await resolveConversation(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo resolver la conversación.");
    } finally {
      await refetch();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">Conversaciones que requieren atención</h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {conversations === null ? (
        <p>Cargando...</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-gray-500">No hay conversaciones escaladas por el bot en este momento.</p>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="rounded border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{conversation.customer_phone}</span>
                <span className="text-xs text-gray-500">
                  {new Date(conversation.last_message_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-700">{conversation.resumen || "(sin resumen)"}</p>
              <button
                onClick={() => handleResolve(conversation.id)}
                className="mt-3 text-xs font-medium text-amber-800 hover:text-amber-950"
              >
                Marcar como resuelta
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
