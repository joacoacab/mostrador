/** Precios de la API de Anthropic en USD por millón de tokens (agosto 2026,
 * https://www.anthropic.com/pricing) -- actualizar esta tabla si cambian
 * los precios o se agrega/cambia el modelo usado (tarea 37). */
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-fable-5": { input: 10, output: 50 },
};

/** Devuelve el costo estimado en USD, o `null` si no hay precio cargado
 * para ese modelo (no rompe el logging, solo no puede estimar el costo). */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = PRICING_PER_MTOK[model];
  if (!pricing) return null;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/** Logea el costo de un llamado (o de todos los turnos de un llamado con
 * tools) a Claude, asociado al teléfono del cliente. `etapa` distingue el
 * router (tarea 38, barato) del modelo principal, para poder comparar. */
export function logUsage(customerPhone: string, etapa: string, model: string, inputTokens: number, outputTokens: number): void {
  const costUsd = estimateCostUsd(model, inputTokens, outputTokens);
  const costLabel = costUsd === null ? "desconocido (sin precio cargado para este modelo)" : `$${costUsd.toFixed(6)}`;
  console.log(
    `[costo-ia] telefono=${customerPhone} etapa=${etapa} modelo=${model} input_tokens=${inputTokens} output_tokens=${outputTokens} costo_usd=${costLabel}`,
  );
}
