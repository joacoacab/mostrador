# Mostrador — contexto para Claude Code

## Qué es este proyecto
Gestor de pedidos multi-rubro con panel interno, pantalla tipo tablet/TV para el local, y (más adelante) un bot de WhatsApp con IA. Spec completa en `docs/spec.md` — **leerla siempre antes de proponer o escribir código**, es la fuente de verdad del proyecto.

## Reglas de trabajo
- No avanzar de fase (ver roadmap en `docs/spec.md`, sección 7) sin aprobación explícita.
- Antes de escribir código: generar o actualizar `docs/plan.md` con el desglose de la fase en curso, y esperar aprobación.
- De `docs/plan.md` a `docs/tasks.md`: una tarea por commit, con criterio de "hecho" claro en cada una.
- Ejecutar de a una tarea por vez salvo indicación explícita de continuar con varias.
- Si algo implementado se desvía de lo que dice `docs/spec.md`, avisar y proponer actualizar la spec — no dejar que quede desactualizada en silencio.

## Stack
- Backend: Django + DRF + PostgreSQL, multi-tenant por `tenant_id`.
- Frontend: React + Vite + Tailwind, como PWA (panel interno en `/panel`, pantalla de solo lectura en `/pantalla`).
- Realtime: WebSocket (Django Channels) para actualizar kanban y pantalla tablet sin polling.
- Deploy: EC2 + Traefik + GitHub Actions (infra propia, separada de otros proyectos).

## Convenciones
- Commits en español, formato imperativo corto (ej. "agrega modelo de Order").
- Un servicio de dominio agnóstico de rubro: nunca hardcodear lógica específica de un negocio (carnicería, chipacitos, etc.) en `order-core`. Cualquier especificidad de rubro va del lado de una integración externa.

## Estado actual
Fase 1 (MVP Order Core standalone) — sin arrancar todavía.