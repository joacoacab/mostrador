import { describe, expect, it } from "vitest";

import { estimateCostUsd } from "./cost.js";

describe("estimateCostUsd", () => {
  it("calcula el costo con la tabla de precios de Haiku 4.5", () => {
    const cost = estimateCostUsd("claude-haiku-4-5", 1_000_000, 1_000_000);

    expect(cost).toBe(6); // $1 input + $5 output por MTok
  });

  it("devuelve null si no hay precio cargado para el modelo", () => {
    const cost = estimateCostUsd("modelo-inventado", 1000, 1000);

    expect(cost).toBeNull();
  });
});
