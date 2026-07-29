import { apiUrl } from "./api";
import type { Order } from "./orders";

const DEVICE_TOKEN_KEY = "mostrador_device_token";

export function getDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEVICE_TOKEN_KEY);
}

export function setDeviceToken(token: string) {
  window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export function clearDeviceToken() {
  window.localStorage.removeItem(DEVICE_TOKEN_KEY);
}

// Igual que authFetch (accounts/auth.ts), pero con el esquema
// "DeviceToken" en vez de "Bearer" -- ver tenants/authentication.py
// del backend sobre por qué son esquemas distintos.
async function deviceFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getDeviceToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `DeviceToken ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

export async function listOrdersForDevice(): Promise<Order[]> {
  // Sin token todavía (pantalla sin parear) no hay nada que pedir --
  // evita golpear la API sin credenciales y disparar el reload de
  // recuperación de más abajo en loop mientras se muestra el form de
  // pairing.
  if (!getDeviceToken()) return [];

  const res = await deviceFetch("/api/orders/");
  if (res.status === 401) {
    // El token dejó de ser válido (poco probable, pero puede pasar si
    // se borra el PairingCode a mano) -- recargar es la forma más
    // simple de volver a la pantalla de pairing sin manejar esto como
    // un caso reactivo más en el componente.
    clearDeviceToken();
    window.location.reload();
    throw new Error("Sesión de dispositivo inválida, recargando...");
  }
  if (!res.ok) throw new Error("No se pudieron cargar los pedidos.");
  return res.json();
}
