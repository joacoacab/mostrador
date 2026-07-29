"use client";

import { useState } from "react";
import { generatePairingCode, type PairingCode } from "@/lib/pairing";

export default function PantallaPairingPage() {
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      setPairing(await generatePairingCode());
    } catch {
      setError("No se pudo generar el código.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold">Parear pantalla</h1>
      <p className="text-sm text-gray-600">
        Generá un código y escribilo en la tablet o TV del local, en{" "}
        <code className="rounded bg-gray-100 px-1">/pantalla</code>. Vale por 10 minutos.
      </p>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Generando..." : "Generar código"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {pairing && (
        <div className="rounded border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">Código</p>
          <p className="text-5xl font-bold tracking-widest">{pairing.code}</p>
          <p className="mt-2 text-xs text-gray-400">
            Vence: {new Date(pairing.expires_at).toLocaleTimeString("es-AR")}
          </p>
        </div>
      )}
    </div>
  );
}
