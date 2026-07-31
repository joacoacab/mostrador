import { afterAll, describe, expect, it } from "vitest";

import { closeRedisClient } from "./redis.js";
import { dequeue, enqueue } from "./queue.js";

describe("cola sobre Redis", () => {
  afterAll(async () => {
    await closeRedisClient();
  });

  it("encola y lee un mensaje de prueba", async () => {
    const queue = `test-queue-${Date.now()}`;
    await enqueue(queue, { texto: "hola" });

    const mensaje = await dequeue<{ texto: string }>(queue, 5);

    expect(mensaje).toEqual({ texto: "hola" });
  });

  it("devuelve null si no hay mensajes dentro del timeout", async () => {
    const queue = `test-queue-vacia-${Date.now()}`;
    const mensaje = await dequeue(queue, 1);
    expect(mensaje).toBeNull();
  });
});
