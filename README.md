# Mostrador

Gestor de pedidos multi-rubro con panel interno, pantalla tipo tablet/TV para el local, y (más adelante) un bot de WhatsApp con IA.

- Spec técnica: [`docs/spec.md`](docs/spec.md) — fuente de verdad del proyecto.
- Plan de la fase en curso: [`docs/plan.md`](docs/plan.md).
- Checklist ejecutable: [`docs/tasks.md`](docs/tasks.md).

## Estructura

- `order-core/backend` — Django + DRF + PostgreSQL.
- `order-core/frontend` — Next.js + TypeScript + Tailwind (PWA).
- `whatsapp-agent` — bot de WhatsApp (Node/TypeScript), Fase 2.

## Estado

Fase 1 (MVP Order Core standalone) completa, en producción. Fase 2 (bot de WhatsApp) en curso. Ver `docs/tasks.md` para el detalle de qué está hecho.
