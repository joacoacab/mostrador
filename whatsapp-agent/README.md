# whatsapp-agent

Servicio de bot de WhatsApp (Fase 2): recibe mensajes vía un `WhatsAppProvider`
(WAHA o Meta Cloud API, ver `docs/plan.md`), los procesa con un agente de
Claude, y habla con el Order Core (`order-core/backend`) para consultar
catálogo/info del tenant y crear/consultar pedidos.

Node/TypeScript + Express, sin framework de más -- el servicio es chico
(webhook + worker).

## Desarrollo local

```bash
npm install
npm run dev
```

## Lint, tests, build

```bash
npm run lint
npm test
npm run build && npm start
```
