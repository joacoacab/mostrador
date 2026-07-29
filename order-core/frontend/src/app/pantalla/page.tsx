"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePolling } from "@/hooks/usePolling";
import { clearDeviceToken, getDeviceToken, listOrdersForDevice, setDeviceToken } from "@/lib/device";
import { claimPairingCode } from "@/lib/pairing";
import type { Estado, Order } from "@/lib/orders";

const POLL_INTERVAL_MS = 5000;

// "Tiempo configurable" de la spec sección 3.5 -- por ahora es una
// constante de código, sin UI para ajustarla en runtime.
const HIDE_ENTREGADO_AFTER_MS = 60_000;

const COLUMNS: { estado: Estado; label: string }[] = [
  { estado: "en_preparacion", label: "En preparación" },
  { estado: "listo", label: "Listo" },
  { estado: "en_camino", label: "En camino" },
  { estado: "entregado", label: "Entregado" },
];

export default function PantallaPage() {
  const [paired, setPaired] = useState(() => getDeviceToken() !== null);
  const [tenantNombre, setTenantNombre] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  const fetcher = useCallback(() => listOrdersForDevice(), []);
  const { data: orders, error } = usePolling<Order[]>(fetcher, POLL_INTERVAL_MS);

  // Date.now() no se puede llamar directo en el render (regla de
  // pureza) -- se mantiene como estado, actualizado cada segundo, así
  // el auto-ocultado de "entregado" se re-evalúa solo con el tiempo.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleClaim(event: FormEvent) {
    event.preventDefault();
    setPairingError(null);
    setPairingLoading(true);
    try {
      const result = await claimPairingCode(code);
      setDeviceToken(result.device_token);
      setTenantNombre(result.tenant_nombre);
      setPaired(true);
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "No se pudo parear.");
    } finally {
      setPairingLoading(false);
    }
  }

  function handleUnpair() {
    clearDeviceToken();
    setPaired(false);
  }

  if (!paired) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 text-white">
        <h1 className="text-4xl font-bold">Mostrador</h1>
        <p className="text-lg text-gray-400">Ingresá el código generado desde el panel</p>
        <form onSubmit={handleClaim} className="flex flex-col items-center gap-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            inputMode="numeric"
            autoFocus
            className="w-64 rounded border border-gray-700 bg-gray-900 px-4 py-3 text-center text-4xl tracking-widest text-white"
          />
          {pairingError && <p className="text-red-400">{pairingError}</p>}
          <button
            type="submit"
            disabled={pairingLoading || code.length !== 6}
            className="rounded bg-white px-6 py-3 text-lg font-semibold text-gray-950 disabled:opacity-50"
          >
            {pairingLoading ? "Pareando..." : "Parear"}
          </button>
        </form>
      </main>
    );
  }

  const visibleOrders = (orders ?? []).filter((order) => {
    if (order.estado !== "entregado") return true;
    return now - new Date(order.updated_at).getTime() < HIDE_ENTREGADO_AFTER_MS;
  });

  return (
    <main className="min-h-screen bg-gray-950 p-8 text-white">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mostrador{tenantNombre ? ` — ${tenantNombre}` : ""}</h1>
        <div className="flex items-center gap-4">
          {error && <p className="text-red-400">{error}</p>}
          <button onClick={handleUnpair} className="text-sm text-gray-500 hover:text-gray-300">
            Despairear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-6">
        {COLUMNS.map((column) => {
          const columnOrders = visibleOrders.filter((o) => o.estado === column.estado);
          return (
            <div key={column.estado} className="rounded-lg bg-gray-900 p-4">
              <h2 className="mb-4 text-2xl font-semibold text-gray-300">{column.label}</h2>
              <div className="space-y-3">
                {columnOrders.map((order) => (
                  <div key={order.id} className="rounded bg-gray-800 p-4">
                    <p className="text-4xl font-bold">#{order.id}</p>
                    <p className="text-lg text-gray-400">{order.customer_nombre}</p>
                  </div>
                ))}
                {columnOrders.length === 0 && <p className="text-gray-600">--</p>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
