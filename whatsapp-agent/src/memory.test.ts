import { afterEach, describe, expect, it } from "vitest";

import { appendTurn, getHistory } from "./memory.js";
import { closeRedisClient } from "./redis.js";

describe("memoria corta por teléfono", () => {
  afterEach(async () => {
    await closeRedisClient();
  });

  it("no hay historial para un teléfono nuevo", async () => {
    const history = await getHistory(`test-memoria-nueva-${Date.now()}`);
    expect(history).toEqual([]);
  });

  it("acumula turnos en orden y los devuelve como user/assistant", async () => {
    const phone = `test-memoria-turnos-${Date.now()}`;

    await appendTurn(phone, "quiero chipa", "¿Cuántas docenas?");
    await appendTurn(phone, "dame 2", "Listo, pedido confirmado.");

    const history = await getHistory(phone);
    expect(history).toEqual([
      { role: "user", content: "quiero chipa" },
      { role: "assistant", content: "¿Cuántas docenas?" },
      { role: "user", content: "dame 2" },
      { role: "assistant", content: "Listo, pedido confirmado." },
    ]);
  });

  it("recorta a los últimos 10 pares para no crecer sin límite", async () => {
    const phone = `test-memoria-recorte-${Date.now()}`;

    for (let i = 0; i < 15; i++) {
      await appendTurn(phone, `mensaje ${i}`, `respuesta ${i}`);
    }

    const history = await getHistory(phone);
    expect(history).toHaveLength(20); // 10 pares * 2
    expect(history[0]).toEqual({ role: "user", content: "mensaje 5" });
    expect(history[history.length - 1]).toEqual({ role: "assistant", content: "respuesta 14" });
  });
});
