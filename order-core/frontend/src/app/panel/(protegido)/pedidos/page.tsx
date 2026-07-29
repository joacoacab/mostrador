"use client";

import Link from "next/link";
import { usePolling } from "@/hooks/usePolling";
import { listOrders, type Order } from "@/lib/orders";

const POLL_INTERVAL_MS = 5000;

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_preparacion: "En preparación",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
  sin_stock: "Sin stock",
  rechazado: "Rechazado",
};

export default function PedidosPage() {
  const { data: orders, error } = usePolling<Order[]>(listOrders, POLL_INTERVAL_MS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <Link href="/panel/pedidos/nuevo" className="text-sm text-gray-500 hover:text-gray-900">
          + Nuevo pedido
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {orders === null ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full max-w-3xl text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">#</th>
              <th className="py-2">Canal</th>
              <th className="py-2">Estado</th>
              <th className="py-2">Creado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-100">
                <td className="py-2">{order.id}</td>
                <td className="py-2">{order.canal}</td>
                <td className="py-2">{ESTADO_LABELS[order.estado] ?? order.estado}</td>
                <td className="py-2">{new Date(order.created_at).toLocaleString("es-AR")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-gray-500">
                  No hay pedidos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
