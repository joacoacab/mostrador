"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
  type ProductInput,
} from "@/lib/products";

const emptyForm: ProductInput = {
  nombre: "",
  precio: "",
  unidad: "",
  disponible: true,
  origen: "manual",
  external_id: null,
};

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // reload() no se llama desde ningún efecto -- solo desde handlers de
  // eventos (submit, borrar) -- así que puede setear estado como
  // quiera. El fetch inicial va aparte, encadenado con .then() en vez
  // de invocar una función que hace setState de forma directa: eso es
  // justo lo que marca react-hooks/set-state-in-effect.
  async function reload() {
    try {
      setProducts(await listProducts());
      setError(null);
    } catch {
      setError("No se pudieron cargar los productos.");
    }
  }

  useEffect(() => {
    let active = true;
    listProducts()
      .then((data) => {
        if (!active) return;
        setProducts(data);
        setError(null);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los productos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      nombre: product.nombre,
      precio: product.precio,
      unidad: product.unidad,
      disponible: product.disponible,
      origen: product.origen,
      external_id: product.external_id,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateProduct(editingId, form);
      } else {
        await createProduct(form);
      }
      cancelEdit();
      await reload();
    } catch {
      setError(editingId ? "No se pudo actualizar el producto." : "No se pudo crear el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("¿Borrar este producto?")) return;
    try {
      await deleteProduct(id);
      await reload();
    } catch {
      setError("No se pudo borrar el producto.");
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Productos</h1>

      <form
        onSubmit={handleSubmit}
        className="grid max-w-2xl grid-cols-2 gap-4 rounded border border-gray-200 p-4"
      >
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium">Nombre</label>
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium">Precio</label>
          <input
            required
            type="number"
            step="0.01"
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium">Unidad</label>
          <input
            required
            placeholder="kg, unidad, docena..."
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium">Origen</label>
          <select
            value={form.origen}
            onChange={(e) =>
              setForm({ ...form, origen: e.target.value as ProductInput["origen"] })
            }
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="manual">Manual</option>
            <option value="integracion">Integración</option>
          </select>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.disponible}
            onChange={(e) => setForm({ ...form, disponible: e.target.checked })}
          />
          Disponible
        </label>

        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {editingId ? "Guardar cambios" : "Crear producto"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded border border-gray-300 px-4 py-2"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full max-w-3xl text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Nombre</th>
              <th className="py-2">Precio</th>
              <th className="py-2">Unidad</th>
              <th className="py-2">Disponible</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-gray-100">
                <td className="py-2">{product.nombre}</td>
                <td className="py-2">${product.precio}</td>
                <td className="py-2">{product.unidad}</td>
                <td className="py-2">{product.disponible ? "Sí" : "No"}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => startEdit(product)}
                    className="mr-3 text-gray-500 hover:text-gray-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-gray-500">
                  No hay productos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
