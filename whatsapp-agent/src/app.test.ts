import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "./app.js";
import { INCOMING_MESSAGES_QUEUE } from "./constants.js";
import { dequeue } from "./queue.js";
import { closeRedisClient } from "./redis.js";

describe("GET /health", () => {
  it("responde 200 con status ok", async () => {
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("webhook de WhatsApp (contra el adapter WAHA)", () => {
  beforeEach(() => {
    process.env.WHATSAPP_PROVIDER = "waha";
    process.env.WAHA_API_KEY = "test-key";
  });

  afterEach(async () => {
    await closeRedisClient();
  });

  it("POST encola el mensaje normalizado en Redis", async () => {
    const response = await request(createApp())
      .post("/webhooks/whatsapp")
      .send({
        event: "message",
        payload: {
          id: "true_5491122334455@c.us_ABC",
          timestamp: 1700000000,
          from: "5491122334455@c.us",
          body: "hola",
          fromMe: false,
        },
      });

    expect(response.status).toBe(200);

    const mensaje = await dequeue(INCOMING_MESSAGES_QUEUE, 5);
    expect(mensaje).toMatchObject({ from: "5491122334455@c.us", text: "hola" });
  });

  it("POST responde 200 sin encolar nada si el evento no trae un mensaje de texto", async () => {
    const response = await request(createApp()).post("/webhooks/whatsapp").send({ event: "message.ack" });
    expect(response.status).toBe(200);
  });

  it("GET da 404: WAHA no tiene verificación por hub.challenge", async () => {
    const response = await request(createApp()).get("/webhooks/whatsapp");
    expect(response.status).toBe(404);
  });
});
