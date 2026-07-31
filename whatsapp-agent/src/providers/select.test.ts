import { describe, expect, it } from "vitest";

import { selectProvider, type ProviderRegistry } from "./select.js";
import type { WhatsAppProvider } from "./types.js";

function fakeProvider(name: string): WhatsAppProvider {
  return {
    name,
    sendMessage: async () => {},
    parseWebhookPayload: () => [],
  };
}

describe("selectProvider", () => {
  const registry: ProviderRegistry = {
    waha: () => fakeProvider("waha"),
    meta: () => fakeProvider("meta"),
  };

  it("devuelve el provider registrado con ese nombre", () => {
    const provider = selectProvider("waha", registry);
    expect(provider.name).toBe("waha");
  });

  it("tira error si falta el nombre", () => {
    expect(() => selectProvider(undefined, registry)).toThrow(/WHATSAPP_PROVIDER/);
  });

  it("tira error con nombre desconocido, listando los disponibles", () => {
    expect(() => selectProvider("otro", registry)).toThrow(/waha, meta/);
  });
});
