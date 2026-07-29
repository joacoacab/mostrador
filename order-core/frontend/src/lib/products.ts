import { authFetch } from "./auth";

export type Product = {
  id: number;
  nombre: string;
  precio: string;
  unidad: string;
  disponible: boolean;
  origen: "manual" | "integracion";
  external_id: string | null;
};

export type ProductInput = Omit<Product, "id">;

export async function listProducts(): Promise<Product[]> {
  const res = await authFetch("/api/products/");
  if (!res.ok) throw new Error("No se pudieron cargar los productos.");
  return res.json();
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const res = await authFetch("/api/products/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("No se pudo crear el producto.");
  return res.json();
}

export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const res = await authFetch(`/api/products/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("No se pudo actualizar el producto.");
  return res.json();
}

export async function deleteProduct(id: number): Promise<void> {
  const res = await authFetch(`/api/products/${id}/`, { method: "DELETE" });
  if (!res.ok) throw new Error("No se pudo borrar el producto.");
}
