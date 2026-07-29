"use client";

import { useEffect, useState } from "react";

// Polling corto (spec sección 3.4 / 6, decisión de Fase 1: sin
// WebSocket todavía). Reusable para cualquier pantalla que necesite
// refrescarse sola -- lista de pedidos (tarea 19), kanban (tarea 20),
// pantalla tablet (tarea 21).
//
// El efecto depende de `fetcher`: si cambia de identidad (ej. porque
// cambiaron filtros), refetchea de inmediato en vez de esperar al
// próximo tick. Quien llama con un fetcher que depende de estado
// (filtros, etc) tiene que memoizarlo con useCallback -- si no, un
// fetcher recreado en cada render reiniciaría el intervalo todo el
// tiempo.
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    function poll() {
      fetcher()
        .then((result) => {
          if (active) {
            setData(result);
            setError(null);
          }
        })
        .catch(() => {
          if (active) setError("No se pudo actualizar.");
        });
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [fetcher, intervalMs]);

  // No se llama desde ningún efecto -- solo pensado para refrescos
  // manuales disparados por el usuario (ej. después de una acción),
  // así que puede setear estado sin problema con
  // react-hooks/set-state-in-effect.
  async function refetch() {
    try {
      setData(await fetcher());
      setError(null);
    } catch {
      setError("No se pudo actualizar.");
    }
  }

  return { data, error, refetch };
}
