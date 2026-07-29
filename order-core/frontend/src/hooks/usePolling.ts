"use client";

import { useEffect, useRef, useState } from "react";

// Polling corto (spec sección 3.4 / 6, decisión de Fase 1: sin
// WebSocket todavía). Reusable para cualquier pantalla que necesite
// refrescarse sola -- kanban (tarea 20), pantalla tablet (tarea 21).
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let active = true;

    function poll() {
      fetcherRef.current()
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
  }, [intervalMs]);

  // No se llama desde ningún efecto -- solo pensado para refrescos
  // manuales disparados por el usuario (ej. después de una acción),
  // así que puede setear estado sin problema con
  // react-hooks/set-state-in-effect.
  async function refetch() {
    try {
      setData(await fetcherRef.current());
      setError(null);
    } catch {
      setError("No se pudo actualizar.");
    }
  }

  return { data, error, refetch };
}
