# whatsapp-agent

Servicio de bot de WhatsApp (Fase 2): recibe mensajes vía un `WhatsAppProvider`
(WAHA o Meta Cloud API, ver `docs/plan.md`), los procesa con un agente de
Claude, y habla con el Order Core (`order-core/backend`) para consultar
catálogo/info del tenant y crear/consultar pedidos.

Node/TypeScript + Express, sin framework de más -- el servicio es chico
(webhook + worker).

`src/providers/types.ts` define la interfaz `WhatsAppProvider` (mensaje
entrante normalizado + `sendMessage`) -- el resto del servicio programa
contra esa interfaz, no contra WAHA o Meta directamente. El adapter activo
se elige por la variable de entorno `WHATSAPP_PROVIDER` (`src/providers/registry.ts`).
Los adapters concretos todavía no existen (tareas 29 y 30).

## Desarrollo local

```bash
cp .env.example .env          # ajustar valores si hace falta
docker compose up -d          # levanta Redis

npm install
npm run dev
```

## Lint, tests, build

```bash
npm run lint
npm test
npm run build && npm start
```
