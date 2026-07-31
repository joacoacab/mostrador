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
- Backend: Django + DRF + PostgreSQL, multi-tenant por `tenant_id`. Producción: gunicorn + whitenoise (estáticos), sin nginx delante del backend.
- Frontend: Next.js (App Router) + TypeScript + Tailwind, export estático (`output: "export"`) — todas las páginas son client components, no hay nada server-side. PWA (manifest nativo + service worker mínimo, panel interno en `/panel`, pantalla de solo lectura en `/pantalla`).
- Realtime: polling corto (5s) contra la API, sin WebSocket — decisión de Fase 1, ver `docs/spec.md` sección 6.
- Deploy: EC2 + Traefik + GitHub Actions. La instancia EC2 es **compartida** con otros proyectos (La Balanza) — "infra separada" se resolvió como contenedores Docker aislados + ruteo por dominio en Traefik (provider de archivo, `~/traefik/routes.yml` en el server), no como una instancia física aparte. Cada proyecto tiene su propio `docker-compose`, su propia red `internal`, y su propio runner de GitHub Actions self-hosted registrado específicamente para ese repo.

## Convenciones
- Commits en español, formato imperativo corto (ej. "agrega modelo de Order").
- Un servicio de dominio agnóstico de rubro: nunca hardcodear lógica específica de un negocio (carnicería, chipacitos, etc.) en `order-core`. Cualquier especificidad de rubro va del lado de una integración externa.

## Estado actual
Fase 1 (MVP Order Core standalone) — completa y en producción (`https://mostrador.siracnetwork.com`). Ver `docs/tasks.md` para el detalle de qué se hizo y `docs/spec.md` sección 7 para el resumen de desviaciones vs. lo planeado. Fase 2 (bot de WhatsApp, texto) en curso — ver `docs/tasks.md` tareas 24 en adelante.