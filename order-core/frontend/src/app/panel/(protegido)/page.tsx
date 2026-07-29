"use client";

import { useCallback, useState, type DragEvent } from "react";
import { usePolling } from "@/hooks/usePolling";
import { listOrders, updateOrderStatus, type Estado, type Order } from "@/lib/orders";

const POLL_INTERVAL_MS = 5000;

const COLUMNS: { estado: Estado; label: string }[] = [
  { estado: "pendiente", label: "Pendiente" },
  { estado: "confirmado", label: "Confirmado" },
  { estado: "en_preparacion", label: "En preparación" },
  { estado: "listo", label: "Listo" },
  { estado: "en_camino", label: "En camino" },
  { estado: "entregado", label: "Entregado" },
];

// Desde qué estados tiene sentido ofrecer "Marcar sin stock" -- tiene
// que coincidir con orders/state_machine.py::TRANSITIONS del backend
// (pendiente y confirmado son las únicas fuentes válidas hacia
// sin_stock). Si no coincidiera, el backend igual lo rechaza con 400;
// esto es solo para no mostrar un botón que sabemos que va a fallar.
const SIN_STOCK_DESDE: Estado[] = ["pendiente", "confirmado"];

export default function KanbanPage() {
  const [canal, setCanal] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const fetcher = useCallback(
    () =>
      listOrders({
        canal: canal || undefined,
        customer_phone: telefono || undefined,
        fecha: fecha || undefined,
      }),
    [canal, telefono, fecha],
  );

  const { data: orders, error, refetch } = usePolling<Order[]>(fetcher, POLL_INTERVAL_MS);

  async function changeStatus(id: number, estado: Estado) {
    setActionError(null);
    try {
      await updateOrderStatus(id, estado);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      await refetch();
    }
  }

  function handleDrop(event: DragEvent, estado: Estado) {
    event.preventDefault();
    if (draggingId !== null) {
      changeStatus(draggingId, estado);
    }
    setDraggingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-500">Canal</label>
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              className="mt-1 rounded border border-gray-300 px-2 py-1"
            >
              <option value="">Todos</option>
              <option value="manual">Manual</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Cliente (teléfono)</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-1 rounded border border-gray-300 px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 rounded border border-gray-300 px-2 py-1"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {orders === null ? (
        <p>Cargando...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const columnOrders = orders.filter((o) => o.estado === column.estado);
            return (
              <div
                key={column.estado}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, column.estado)}
                className="w-64 shrink-0 rounded border border-gray-200 bg-gray-50 p-3"
              >
                <h2 className="mb-3 text-sm font-semibold text-gray-700">
                  {column.label} <span className="text-gray-400">({columnOrders.length})</span>
                </h2>
                <div className="space-y-2">
                  {columnOrders.map((order) => (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={() => setDraggingId(order.id)}
                      className="cursor-move rounded border border-gray-300 bg-white p-2 text-sm shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">#{order.id}</span>
                        <span className="text-xs text-gray-400">{order.canal}</span>
                      </div>
                      <p className="text-gray-700">{order.customer_nombre}</p>
                      <p className="text-xs text-gray-500">{order.customer_telefono}</p>
                      <ul className="mt-1 text-xs text-gray-600">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            {item.cantidad} x {item.product_nombre}
                          </li>
                        ))}
                      </ul>
                      {order.notas && (
                        <p className="mt-1 text-xs italic text-gray-500">{order.notas}</p>
                      )}
                      {SIN_STOCK_DESDE.includes(order.estado) && (
                        <button
                          onClick={() => changeStatus(order.id, "sin_stock")}
                          className="mt-2 text-xs text-amber-700 hover:text-amber-900"
                        >
                          Marcar sin stock
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
