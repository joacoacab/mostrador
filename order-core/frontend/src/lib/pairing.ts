import { apiUrl } from "./api";
import { authFetch } from "./auth";

export type PairingCode = {
  code: string;
  expires_at: string;
};

// Llamado desde el panel (usuario logueado) para generar un código
// que después se escribe en la tablet.
export async function generatePairingCode(): Promise<PairingCode> {
  const res = await authFetch("/api/pairing/generate/", { method: "POST" });
  if (!res.ok) throw new Error("No se pudo generar el código.");
  return res.json();
}

export type ClaimResult = {
  device_token: string;
  tenant_nombre: string;
};

// Llamado desde /pantalla, sin ninguna sesión todavía -- el código es
// la única credencial en este punto.
export async function claimPairingCode(code: string): Promise<ClaimResult> {
  const res = await fetch(apiUrl("/api/pairing/claim/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? "Código inválido.");
  }
  return res.json();
}
