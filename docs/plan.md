# Plan — Fase 1: MVP Order Core standalone

Basado en `docs/spec.md`, secciones 3, 6 y 7. Alcance: modelo de datos, API y panel kanban básico, **sin bot de WhatsApp** (carga manual de pedidos). Sin escribir código todavía — esto es el desglose para acordar antes de pasar a `docs/tasks.md`.

## Objetivo de la fase

Tener un Order Core funcional y aislado (sin integración con La Balanza ni bot) donde un operador pueda: loguearse, cargar/gestionar catálogo, crear pedidos manualmente, moverlos por la máquina de estados, y verlos en un kanban y en una pantalla de solo lectura tipo tablet. Todo con scoping estricto por `tenant_id`.

## Criterio de éxito de la fase

- Un tenant no puede ver ni modificar datos de otro tenant (verificado con tests).
- La máquina de estados de `Order` rechaza transiciones inválidas y genera `OrderEvent` en cada transición válida.
- El panel kanban y la pantalla tablet reflejan cambios de estado (polling corto, sin WebSocket en esta fase).
- Todo corre deployado en la infra propia (EC2 + Traefik + GitHub Actions, PostgreSQL en Docker en la misma instancia).

## Orden y por qué

Modelo de datos y API primero, panel visual después (sección 9 de la spec): no tiene sentido construir UI sobre contratos que todavía van a cambiar. Dentro del backend, el orden respeta dependencias reales: no hay `Order` sin `Product`, no hay scoping multi-tenant probado sin que exista `Tenant` primero, no hay auth sin `User`.

---

## Desglose de tareas (orden de ejecución)

### Etapa 0 — Fundación del repo

1. **Setup del monorepo**: estructura `order-core/backend`, `order-core/frontend`, `.gitignore`, README mínimo.
   - *Hecho cuando*: estructura de carpetas existe y commiteada, sin código funcional todavía.
2. **CI básico**: pipeline de GitHub Actions que al menos corra lint + tests en cada push/PR (vacío de contenido real hasta que haya tests que correr, pero el workflow debe existir y pasar en verde).
   - *Hecho cuando*: workflow corre en un PR de prueba y termina en verde.

### Etapa 1 — Backend: base del proyecto Django

3. **Proyecto Django + apps**: crear proyecto y apps `tenants`, `accounts`, `catalog`, `orders` (sin modelos todavía, solo esqueleto + settings + conexión a PostgreSQL en Docker).
   - *Hecho cuando*: `manage.py runserver` levanta contra PostgreSQL en Docker sin errores.

### Etapa 2 — Modelo de dominio y multi-tenancy (base crítica, revisar a mano)

4. **Modelo `Tenant`** + migración.
5. **Modelo `User`** (con `rol` admin/empleado) + migración, relacionado a `Tenant`.
6. **Mecanismo de scoping por `tenant_id`**: middleware o manager custom que fuerza el filtro de tenant en cada query, antes de agregar el resto de los modelos que dependen de esto.
   - *Hecho cuando*: existe un test que prueba que un query sin tenant explícito no devuelve datos de otro tenant.
7. **Modelos `Product`, `Customer`, `Order`, `OrderItem`, `OrderEvent`** (sección 3.1) + migraciones, todos scopeados por el mecanismo de la tarea 6.
   - *Hecho cuando*: migraciones aplican limpio y cada modelo tiene su `tenant_id` (directo o heredado vía FK) cubierto por el scoping.

### Etapa 3 — Auth

8. **Auth JWT** con rol admin/empleado sobre el modelo `User` de la tarea 5.
   - *Hecho cuando*: login devuelve token JWT válido, y endpoints protegidos rechazan requests sin token o con rol insuficiente.

### Etapa 4 — API de catálogo y pedidos

9. **API CRUD de `Product`** (`GET/POST/PATCH/DELETE`), scopeada por tenant y protegida por auth.
10. **API de `Order`**: crear, listar, filtrar por estado/cliente/fecha, `GET /orders/{id}`, `PATCH /orders/{id}/status` con validación de la máquina de estados (sección 3.2) y creación automática de `OrderEvent` en cada transición.
    - *Hecho cuando*: existen tests que cubren transiciones válidas e inválidas de la máquina de estados, y cada transición válida deja un `OrderEvent` registrado.
11. **Endpoint `GET /catalog`** (versión standalone, sirve directo desde `Product` — el modo integración con La Balanza es Fase 4).

### Etapa 5 — Tests de base (antes de seguir a frontend)

12. **Tests de máquina de estados y scoping multi-tenant**: consolidar y completar la cobertura de las tareas 6 y 10 (que ya vienen con tests parciales) antes de invertir en frontend, porque son la base de todo lo demás.

### Etapa 6 — Frontend: fundación + flujos manuales

13. **Setup frontend**: proyecto Next.js + TypeScript + Tailwind dentro de `order-core/frontend`, configuración de PWA (`next-pwa`, manifest, service worker) desde el arranque para no migrarlo después.
14. **Login** (consume la API de la tarea 8).
15. **CRUD de productos** (consume la API de la tarea 9).
16. **Alta manual de pedido** (consume la API de la tarea 10).

### Etapa 7 — Frontend: paneles en tiempo real

17. **Polling corto**: mecanismo de refresco periódico en el frontend contra la API de pedidos (sección 6 de la spec: WebSocket queda para más adelante si hace falta, no forma parte de esta fase).
18. **Panel kanban** (`/panel`, sección 3.4): tablero por estado, filtro por canal/cliente/fecha, disparo de respuesta automática al marcar "sin stock" (placeholder sin bot real todavía, solo el evento/hook), actualización vía el polling de la tarea 17.
19. **Pantalla tablet/TV** (`/pantalla`, sección 3.5): solo lectura, pairing simple por código/QR, tipografía grande, columnas por estado, auto-ocultado de pedidos entregados después de un tiempo configurable, mismo mecanismo de polling que el panel.

### Etapa 8 — Cierre de fase

20. **Deploy**: EC2 + Traefik + GitHub Actions, PostgreSQL en Docker en la misma instancia, infra propia separada de La Balanza.
21. **Checkpoint de fase**: resumen de lo implementado vs. lo especificado en `docs/spec.md`, actualizar la spec si algo cambió en el camino.

---

## Decisiones abiertas a confirmar antes de pasar a `tasks.md`

- **Intervalo de polling (tarea 17)**: cada cuánto refresca el panel y la pantalla tablet — afecta carga sobre el backend y percepción de "tiempo real".
- **Pairing de la pantalla tablet (tarea 19)**: ¿código numérico simple o QR con token?
- **Entorno de PostgreSQL para desarrollo local**: ¿Docker Compose desde la tarea 3, o instancia local directa?

## Siguiente paso

Revisar este desglose, ajustar lo que no cierre, y recién ahí convertirlo en `docs/tasks.md` (checklist ejecutable, una tarea por commit, con criterio de "hecho" — varios ya están esbozados arriba).
