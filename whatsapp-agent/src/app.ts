import express, { type Express } from "express";

import { INCOMING_MESSAGES_QUEUE } from "./constants.js";
import { getActiveProvider } from "./providers/registry.js";
import { enqueue } from "./queue.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Verificación por GET (hub.challenge de Meta, tarea 30). WAHA no la
  // necesita -- provider.verifyWebhook queda undefined para ese adapter.
  app.get("/webhooks/whatsapp", (req, res) => {
    const provider = getActiveProvider();
    if (!provider.verifyWebhook) {
      res.sendStatus(404);
      return;
    }
    const challenge = provider.verifyWebhook(req.query as Record<string, string>);
    if (challenge === null) {
      res.sendStatus(403);
      return;
    }
    res.send(challenge);
  });

  app.post("/webhooks/whatsapp", async (req, res) => {
    const provider = getActiveProvider();
    const messages = provider.parseWebhookPayload(req.body);
    await Promise.all(messages.map((message) => enqueue(INCOMING_MESSAGES_QUEUE, message)));
    res.sendStatus(200);
  });

  return app;
}
