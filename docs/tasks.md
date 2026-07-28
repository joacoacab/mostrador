# Tareas — Fase 1: MVP Order Core standalone

Generado a partir de `docs/plan.md` (aprobado). Checklist ejecutable: **una tarea = un commit**. Se ejecuta de a una tarea por vez salvo indicación explícita de continuar con varias (ver `CLAUDE.md`). Los checkpoints de la Etapa 2 (modelo de dominio, scoping multi-tenant, máquina de estados) se revisan a mano antes de avanzar en bloque con el resto.

## Decisiones asumidas (no confirmadas explícitamente, default razonable — avisar si hay que ajustar)

- **Intervalo de polling**: 5 segundos tanto en `/panel` como en `/pantalla`, configurable por variable de entorno del frontend.
- **Pairing de la pantalla tablet**: código numérico de 6 dígitos generado por tenant desde el panel (sin QR en esta fase — más simple de implementar, QR queda como mejora futura).
- **PostgreSQL local**: Docker Compose desde la tarea 3 en adelante.

---

## Checklist

### Etapa 0 — Fundación del repo

- [x] **1. Setup del monorepo**
  Crear estructura `order-core/backend`, `order-core/frontend`, `.gitignore`, README mínimo con instrucciones de arranque.
  Hecho cuando: estructura de carpetas commiteada, sin código funcional todavía.

- [x] **2. CI básico**
  Workflow de GitHub Actions que corra lint + tests en cada push/PR sobre `order-core/backend` y `order-core/frontend`.
  Hecho cuando: el workflow existe, corre en un PR de prueba y termina en verde (aunque no haya tests reales todavía, el step debe ejecutarse sin error).

### Etapa 1 — Backend: base del proyecto Django

- [x] **3. Proyecto Django + apps**
  Crear proyecto Django y apps `tenants`, `accounts`, `catalog`, `orders` (sin modelos todavía). `docker-compose.yml` con PostgreSQL para desarrollo local.
  Hecho cuando: `docker compose up` levanta PostgreSQL y `manage.py runserver` conecta sin errores.

### Etapa 2 — Modelo de dominio y multi-tenancy (revisar a mano antes de seguir)

- [ ] **4. Modelo `Tenant`**
  Campos según spec sección 3.1 (`id`, `nombre`, `slug`, `plan`, `created_at`) + migración.
  Hecho cuando: migración aplica limpio, admin de Django permite crear un `Tenant`.

- [x] **5. Modelo `User`**
  Campos según spec (`tenant_id`, `email`, `password_hash`, `rol` admin/empleado, `nombre`), relacionado a `Tenant` + migración.
  Nota de implementación: extender `AbstractUser`/`AbstractBaseUser` de Django en vez de manejar un campo `password_hash` a mano — Django ya resuelve el hasheo de contraseñas de forma segura, no tiene sentido reimplementarlo. El campo `password_hash` de la spec se satisface con el `password` que da Django por herencia; no es un desvío de la spec, es un detalle de implementación.
  Hecho cuando: migración aplica limpio, se puede crear un `User` asociado a un `Tenant` vía admin o shell.

- [x] **6. Mecanismo de scoping por `tenant_id`**
  Middleware o manager custom que fuerza el filtro de tenant en cada query.
  Hecho cuando: existe un test automatizado que prueba que un query sin tenant explícito no devuelve datos de otro tenant (usando los modelos `Tenant`/`User` ya creados).

- [ ] **7a. Modelo `Product`**
  Campos según spec (`nombre`, `precio`, `unidad`, `disponible`, `origen`, `external_id`) + migración, scopeado por tenant (tarea 6).
  Hecho cuando: migración aplica, test de scoping pasa para `Product`.

- [ ] **7b. Modelo `Customer`**
  Campos según spec (`telefono` único por tenant, `nombre`, `created_at`) + migración, scopeado por tenant.
  Hecho cuando: migración aplica, test de scoping pasa para `Customer`.

- [ ] **7c. Modelos `Order` + `OrderItem`**
  Campos según spec sección 3.1, `OrderItem` con `precio_unitario_snapshot` (copia el precio al momento del pedido) + migraciones, scopeados por tenant.
  Hecho cuando: migraciones aplican, test de scoping pasa para `Order`, y un `OrderItem` creado conserva el precio aunque el `Product` cambie de precio después.

- [ ] **7d. Modelo `OrderEvent`**
  Auditoría (`estado_anterior`, `estado_nuevo`, `actor`, `created_at`) + migración.
  Hecho cuando: migración aplica, se puede crear un `OrderEvent` asociado a un `Order`.

### Etapa 3 — Auth

- [ ] **8. Auth JWT**
  Login con rol admin/empleado sobre el modelo `User`.
  Hecho cuando: login devuelve un JWT válido; un endpoint protegido de prueba rechaza requests sin token y rechaza acciones fuera del rol permitido.

### Etapa 4 — API de catálogo y pedidos

- [ ] **9. API CRUD de `Product`**
  `GET/POST/PATCH/DELETE`, scopeada por tenant y protegida por auth (tarea 8).
  Hecho cuando: tests cubren que un usuario del tenant A no puede leer ni modificar productos del tenant B.

- [ ] **10. API de `Order` — lectura**
  `GET /orders` (filtro por estado/cliente/fecha), `GET /orders/{id}`, `GET /orders?customer_phone=`.
  Hecho cuando: tests cubren los filtros y el scoping por tenant.

- [ ] **11. API de `Order` — creación**
  `POST /orders` con sus `OrderItem`, copiando `precio_unitario_snapshot` del producto al momento de la creación.
  Hecho cuando: test verifica que el precio queda "congelado" en el pedido aunque el producto cambie de precio después.

- [ ] **12. API de `Order` — transición de estado**
  `PATCH /orders/{id}/status` con validación de la máquina de estados (spec sección 3.2) y creación automática de `OrderEvent` en cada transición.
  Hecho cuando: tests cubren todas las transiciones válidas e inválidas descritas en la spec, y cada transición válida deja un `OrderEvent` registrado con el actor correcto.

- [ ] **13. Endpoint `GET /catalog`**
  Versión standalone, sirve productos disponibles directo desde `Product` (el modo integración con La Balanza queda para Fase 4).
  Hecho cuando: devuelve solo productos `disponible=true` del tenant correspondiente.

### Etapa 5 — Tests de base (antes de frontend)

- [ ] **14. Consolidar tests de máquina de estados y scoping multi-tenant**
  Revisar cobertura acumulada de las tareas 6, 9, 10, 11, 12 y cerrar huecos.
  Hecho cuando: suite de tests corre en verde en CI (tarea 2) y cubre explícitamente: aislamiento entre tenants en cada modelo, y cada transición de estado válida/inválida.

### Etapa 6 — Frontend: fundación + flujos manuales

- [ ] **15. Setup frontend**
  Proyecto Next.js + TypeScript + Tailwind en `order-core/frontend`, configuración de PWA con `next-pwa` (manifest, service worker) desde el arranque.
  Hecho cuando: `npm run build` genera el manifest y el service worker; la app instala como PWA en Chrome/Android.

- [ ] **16. Login**
  Pantalla de login que consume la API de la tarea 8, guarda el JWT y protege las rutas de `/panel`.
  Hecho cuando: login exitoso redirige al panel; sin sesión, `/panel` redirige a login.

- [ ] **17. CRUD de productos**
  Pantalla en `/panel` que consume la API de la tarea 9.
  Hecho cuando: se puede crear, editar, listar y borrar un producto desde la UI.

- [ ] **18. Alta manual de pedido**
  Formulario en `/panel` que consume la API de las tareas 10-11 (elegir cliente/productos, crear pedido).
  Hecho cuando: se puede crear un pedido desde la UI y verlo reflejado vía `GET /orders/{id}`.

### Etapa 7 — Frontend: paneles con polling

- [ ] **19. Polling corto**
  Hook/mecanismo de refresco periódico (5s, según decisión asumida arriba) contra la API de pedidos.
  Hecho cuando: la UI refleja un cambio de estado hecho por otro cliente/pestaña dentro de ~5s sin recargar la página.

- [ ] **20. Panel kanban** (`/panel`, spec sección 3.4)
  Tablero por estado, filtros por canal/cliente/fecha, acción "marcar sin stock" (dispara el evento/hook, sin bot real todavía — placeholder), actualización vía polling (tarea 19).
  Hecho cuando: mover un pedido de columna dispara `PATCH /orders/{id}/status`, y los filtros funcionan sobre datos reales.

- [ ] **21. Pantalla tablet/TV** (`/pantalla`, spec sección 3.5)
  Solo lectura, pairing por código numérico (decisión asumida arriba), tipografía grande, columnas por estado, auto-ocultado de pedidos entregados después de un tiempo configurable, mismo polling que el panel.
  Hecho cuando: una tablet pareada muestra pedidos en tiempo real (vía polling) y los entregados desaparecen solos pasado el tiempo configurado.

### Etapa 8 — Cierre de fase

- [ ] **22. Deploy**
  EC2 + Traefik + GitHub Actions, PostgreSQL en Docker en la misma instancia, infra propia separada de La Balanza.
  Hecho cuando: la app es accesible por HTTPS en un dominio/subdominio propio, y un push a `main` dispara deploy automático vía Actions.

- [ ] **23. Checkpoint de fase**
  Resumen de lo implementado vs. lo especificado en `docs/spec.md`; actualizar la spec si algo cambió en el camino.
  Hecho cuando: `docs/spec.md` refleja el estado real del sistema, y hay un resumen del checkpoint (en el PR o en un doc aparte) para aprobar el paso a Fase 2.

---

## Cómo seguir

Arrancamos por la tarea 1, una por vez. Después de validar las tareas de la Etapa 2 (4 a 7d) a mano, se puede pedir avanzar con varias tareas seguidas de una.
