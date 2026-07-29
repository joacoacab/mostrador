"use client";

import { useEffect, useState, type FormEvent } from "react";
import { listCatalog, type Product } from "@/lib/products";
import {
  createCustomer,
  createOrder,
  findCustomerByPhone,
  getOrder,
  type Order,
} from "@/lib/orders";

type ItemRow = { product: string; cantidad: string };

const emptyRow: ItemRow = { product: "", cantidad: "1" };

export default function NuevoPedidoPage() {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [telefono, setTelefono] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyRow]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  useEffect(() => {
    let active = true;
    listCatalog()
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el catálogo.");
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyRow]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setTelefono("");
    setNombreCliente("");
    setNotas("");
    setItems([emptyRow]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const validItems = items
      .filter((row) => row.product && Number(row.cantidad) > 0)
      .map((row) => ({ product: Number(row.product), cantidad: row.cantidad }));

    if (validItems.length === 0) {
      setError("Agregá al menos un producto con cantidad.");
      return;
    }

    setSaving(true);
    try {
      let customer = await findCustomerByPhone(telefono);
      if (!customer) {
        customer = await createCustomer({ telefono, nombre: nombreCliente });
      }

      const created = await createOrder({
        customer: customer.id,
        canal: "manual",
        notas,
        items: validItems,
      });

      // Releemos el pedido con GET /orders/{id} en vez de confiar solo
      // en la respuesta del POST -- es lo que pide el criterio de la
      // tarea 18.
      const confirmed = await getOrder(created.id);
      setCreatedOrder(confirmed);
      resetForm();
    } catch {
      setError("No se pudo crear el pedido. Revisá los datos e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function productName(id: number) {
    return catalog.find((p) => p.id === id)?.nombre ?? `#${id}`;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold">Nuevo pedido</h1>

      {createdOrder && (
        <div className="rounded border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-medium">
            Pedido #{createdOrder.id} creado (estado: {createdOrder.estado}).
          </p>
          <ul className="mt-2 list-disc pl-5">
            {createdOrder.items.map((item) => (
              <li key={item.id}>
                {item.cantidad} x {productName(item.product)} -- ${item.precio_unitario_snapshot} c/u
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Teléfono del cliente</label>
            <input
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Nombre del cliente</label>
            <input
              required
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Si ya existe un cliente con ese teléfono, se usa el que ya está cargado.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Productos</label>
          {loadingCatalog ? (
            <p className="mt-1 text-sm text-gray-500">Cargando catálogo...</p>
          ) : (
            <div className="mt-2 space-y-2">
              {items.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={row.product}
                    onChange={(e) => updateItem(index, { product: e.target.value })}
                    className="flex-1 rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">Elegir producto...</option>
                    {catalog.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.nombre} (${product.precio}/{product.unidad})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.cantidad}
                    onChange={(e) => updateItem(index, { cantidad: e.target.value })}
                    className="w-24 rounded border border-gray-300 px-3 py-2"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem} className="text-sm text-gray-500 hover:text-gray-900">
                + Agregar producto
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || loadingCatalog}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear pedido"}
        </button>
      </form>
    </div>
  );
}
