import { apiUrl } from "./api";

const ACCESS_TOKEN_KEY = "mostrador_access_token";
const REFRESH_TOKEN_KEY = "mostrador_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export type MeResponse = {
  id: number;
  username: string;
  nombre: string;
  rol: "admin" | "empleado";
  tenant: number;
};

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(apiUrl("/api/auth/token/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error("Usuario o contraseña incorrectos.");
  }

  const data = await response.json();
  setTokens(data.access, data.refresh);
}

// No maneja refresh de token todavía -- si el access token expira, el
// usuario tiene que volver a loguearse. Suficiente para esta etapa;
// se puede agregar refresh automático más adelante si molesta en la
// práctica.
export async function fetchMe(): Promise<MeResponse | null> {
  const response = await authFetch("/api/auth/me/");
  if (!response.ok) return null;
  return response.json();
}

// Fetch autenticado: agrega el access token guardado como header
// Authorization. Base para cualquier llamada a la API que requiera
// sesión (productos, pedidos, etc).
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}
