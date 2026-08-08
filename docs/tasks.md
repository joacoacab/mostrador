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

- [x] **4. Modelo `Tenant`**
  Campos según spec sección 3.1 (`id`, `nombre`, `slug`, `plan`, `created_at`) + migración.
  Hecho cuando: migración aplica limpio, admin de Django permite crear un `Tenant`.

- [x] **5. Modelo `User`**
  Campos según spec (`tenant_id`, `email`, `password_hash`, `rol` admin/empleado, `nombre`), relacionado a `Tenant` + migración.
  Nota de implementación: extender `AbstractUser`/`AbstractBaseUser` de Django en vez de manejar un campo `password_hash` a mano — Django ya resuelve el hasheo de contraseñas de forma segura, no tiene sentido reimplementarlo. El campo `password_hash` de la spec se satisface con el `password` que da Django por herencia; no es un desvío de la spec, es un detalle de implementación.
  Hecho cuando: migración aplica limpio, se puede crear un `User` asociado a un `Tenant` vía admin o shell.

- [x] **6. Mecanismo de scoping por `tenant_id`**
  Middleware o manager custom que fuerza el filtro de tenant en cada query.
  Hecho cuando: existe un test automatizado que prueba que un query sin tenant explícito no devuelve datos de otro tenant (usando los modelos `Tenant`/`User` ya creados).

- [x] **7a. Modelo `Product`**
  Campos según spec (`nombre`, `precio`, `unidad`, `disponible`, `origen`, `external_id`) + migración, scopeado por tenant (tarea 6).
  Hecho cuando: migración aplica, test de scoping pasa para `Product`.

- [x] **7b. Modelo `Customer`**
  Campos según spec (`telefono` único por tenant, `nombre`, `created_at`) + migración, scopeado por tenant.
  Hecho cuando: migración aplica, test de scoping pasa para `Customer`.

- [x] **7c. Modelos `Order` + `OrderItem`**
  Campos según spec sección 3.1, `OrderItem` con `precio_unitario_snapshot` (copia el precio al momento del pedido) + migraciones, scopeados por tenant.
  Hecho cuando: migraciones aplican, test de scoping pasa para `Order`, y un `OrderItem` creado conserva el precio aunque el `Product` cambie de precio después.

- [x] **7d. Modelo `OrderEvent`**
  Auditoría (`estado_anterior`, `estado_nuevo`, `actor`, `created_at`) + migración.
  Hecho cuando: migración aplica, se puede crear un `OrderEvent` asociado a un `Order`.

### Etapa 3 — Auth

- [x] **8. Auth JWT**
  Login con rol admin/empleado sobre el modelo `User`.
  Hecho cuando: login devuelve un JWT válido; un endpoint protegido de prueba rechaza requests sin token y rechaza acciones fuera del rol permitido.

### Etapa 4 — API de catálogo y pedidos

- [x] **9. API CRUD de `Product`**
  `GET/POST/PATCH/DELETE`, scopeada por tenant y protegida por auth (tarea 8).
  Hecho cuando: tests cubren que un usuario del tenant A no puede leer ni modificar productos del tenant B.

- [x] **10. API de `Order` — lectura**
  `GET /orders` (filtro por estado/cliente/fecha), `GET /orders/{id}`, `GET /orders?customer_phone=`.
  Hecho cuando: tests cubren los filtros y el scoping por tenant.

- [x] **11. API de `Order` — creación**
  `POST /orders` con sus `OrderItem`, copiando `precio_unitario_snapshot` del producto al momento de la creación.
  Hecho cuando: test verifica que el precio queda "congelado" en el pedido aunque el producto cambie de precio después.

- [x] **12. API de `Order` — transición de estado**
  `PATCH /orders/{id}/status` con validación de la máquina de estados (spec sección 3.2) y creación automática de `OrderEvent` en cada transición.
  Hecho cuando: tests cubren todas las transiciones válidas e inválidas descritas en la spec, y cada transición válida deja un `OrderEvent` registrado con el actor correcto.

- [x] **13. Endpoint `GET /catalog`**
  Versión standalone, sirve productos disponibles directo desde `Product` (el modo integración con La Balanza queda para Fase 4).
  Hecho cuando: devuelve solo productos `disponible=true` del tenant correspondiente.

### Etapa 5 — Tests de base (antes de frontend)

- [x] **14. Consolidar tests de máquina de estados y scoping multi-tenant**
  Revisar cobertura acumulada de las tareas 6, 9, 10, 11, 12 y cerrar huecos.
  Hecho cuando: suite de tests corre en verde en CI (tarea 2) y cubre explícitamente: aislamiento entre tenants en cada modelo, y cada transición de estado válida/inválida.

  No se agregaron tests nuevos para esta tarea -- la cobertura ya quedó cerrada al construir cada pieza en las tareas 6-13. Esto es el registro de qué cubre qué, 54 tests en total (verificado en verde en CI en los commits de las tareas 8 a 13: `4a35819`, `7324004`, `a6525e8`, `b08a247`, `2b4451f`, `1503715`).

  | Área de la spec | Dónde | Tests |
  |---|---|---|
  | Mecanismo de scoping en sí (ContextVar + `TenantManager` + middleware) | `tenancy/tests.py` | `TenantScopedManagerTests` (3), `TenantMiddlewareTests` (3) |
  | Aislamiento — `User` | `tenancy/tests.py::TenantScopedManagerTests` | 3 |
  | Aislamiento — `Product` | `catalog/tests.py::ProductScopingTests` + `ProductAPITests` (404 en get/patch/delete cross-tenant) | 3 + 3 |
  | Aislamiento — `Customer` (+ teléfono único por tenant) | `orders/tests.py::CustomerScopingTests` | 4 |
  | Aislamiento — `Order` | `orders/tests.py::OrderScopingTests` + `OrderReadAPITests` (list/retrieve/customer_phone cross-tenant) + `OrderCreateAPITests` (no usar producto/cliente de otro tenant) + `OrderStatusAPITests` (404 cross-tenant) | 3 + 2 + 2 + 1 |
  | `GET /catalog` (solo disponibles, propio tenant) | `catalog/tests.py::CatalogViewTests` | 2 |
  | `precio_unitario_snapshot` se congela | `orders/tests.py::OrderItemSnapshotTests` + `OrderCreateAPITests::test_crea_pedido_con_items_y_congela_el_precio` | 1 + 1 |
  | Máquina de estados (sección 3.2) — transiciones válidas/inválidas, estados terminales, `OrderEvent` con estado_anterior/nuevo/actor | `orders/tests.py::StateMachineTests` (unit, contra `transition_order` directo) + `OrderStatusAPITests` (a través del endpoint) | 5 + 4 |
  | `OrderEvent` se crea al asociarse a un `Order` | `orders/tests.py::OrderEventTests` | 1 |
  | Auth JWT (login, endpoint protegido, permiso por rol, tenant en contexto vía token) | `accounts/tests.py::AuthJWTTests` + `TenantAwareJWTAuthenticationTests` | 6 + 1 |

  Huecos conocidos, no bloqueantes para Fase 1: no hay test de que `Order.customer.tenant` coincida con `Order.tenant` (hoy no está validado ni a nivel modelo ni serializer, se asume por construcción ya que `customer` sale de un queryset scopeado); no hay test de concurrencia sobre `transition_order` (dos requests cambiando el mismo pedido a la vez). Quedan anotados para revisar si aparece un caso real, no vale la pena un test especulativo ahora.

### Etapa 6 — Frontend: fundación + flujos manuales

- [x] **15. Setup frontend**
  Proyecto Next.js + TypeScript + Tailwind en `order-core/frontend`, configuración de PWA con `next-pwa` (manifest, service worker) desde el arranque.
  Hecho cuando: `npm run build` genera el manifest y el service worker; la app instala como PWA en Chrome/Android.

- [x] **16. Login**
  Pantalla de login que consume la API de la tarea 8, guarda el JWT y protege las rutas de `/panel`.
  Hecho cuando: login exitoso redirige al panel; sin sesión, `/panel` redirige a login.

- [x] **17. CRUD de productos**
  Pantalla en `/panel` que consume la API de la tarea 9.
  Hecho cuando: se puede crear, editar, listar y borrar un producto desde la UI.

- [x] **18. Alta manual de pedido**
  Formulario en `/panel` que consume la API de las tareas 10-11 (elegir cliente/productos, crear pedido).
  Hecho cuando: se puede crear un pedido desde la UI y verlo reflejado vía `GET /orders/{id}`.

- [x] **18b. Documentación de API (drf-spectacular)**
  Instalar `drf-spectacular`, configurarlo en `settings.py`, exponer `/api/schema/` (esquema OpenAPI) y `/api/docs/` (Swagger UI).
  Hecho cuando: `/api/docs/` muestra todos los endpoints existentes (auth, products, orders, customers, catalog) navegables y probables desde el browser.

### Etapa 7 — Frontend: paneles con polling

- [x] **19. Polling corto**
  Hook/mecanismo de refresco periódico (5s, según decisión asumida arriba) contra la API de pedidos.
  Hecho cuando: la UI refleja un cambio de estado hecho por otro cliente/pestaña dentro de ~5s sin recargar la página.

- [x] **20. Panel kanban** (`/panel`, spec sección 3.4)
  Tablero por estado, filtros por canal/cliente/fecha, acción "marcar sin stock" (dispara el evento/hook, sin bot real todavía — placeholder), actualización vía polling (tarea 19).
  Hecho cuando: mover un pedido de columna dispara `PATCH /orders/{id}/status`, y los filtros funcionan sobre datos reales.

- [x] **21. Pantalla tablet/TV** (`/pantalla`, spec sección 3.5)
  Solo lectura, pairing por código numérico (decisión asumida arriba), tipografía grande, columnas por estado, auto-ocultado de pedidos entregados después de un tiempo configurable, mismo polling que el panel.
  Hecho cuando: una tablet pareada muestra pedidos en tiempo real (vía polling) y los entregados desaparecen solos pasado el tiempo configurado.

### Etapa 8 — Cierre de fase

- [x] **22. Deploy**
  EC2 + Traefik + GitHub Actions, PostgreSQL en Docker en la misma instancia. Misma instancia EC2 que La Balanza (dev server compartido), aislado por contenedores + ruteo por dominio en Traefik -- ver `docs/spec.md` sección 6/7.
  Hecho cuando: la app es accesible por HTTPS en un dominio/subdominio propio, y un push a `main` dispara deploy automático vía Actions.

  Dominios: `mostrador.siracnetwork.com` (frontend) / `api.mostrador.siracnetwork.com` (backend), ambos con certificado real de Let's Encrypt. Verificado con Playwright contra las URLs públicas reales: login, kanban, alta de producto contra la API en producción -- sin errores de consola.

- [x] **23. Checkpoint de fase**
  Resumen de lo implementado vs. lo especificado en `docs/spec.md`; actualizar la spec si algo cambió en el camino.
  Hecho cuando: `docs/spec.md` refleja el estado real del sistema, y hay un resumen del checkpoint (en el PR o en un doc aparte) para aprobar el paso a Fase 2.

  ### Resumen del checkpoint

  **Implementado, coincide con la spec**: modelo de dominio completo (`Tenant`, `User`, `Customer`, `Product`, `Order`, `OrderItem`, `OrderEvent`), scoping multi-tenant por `tenant_id`, máquina de estados con auditoría (`OrderEvent`), API de catálogo/pedidos/productos, auth JWT con roles, panel kanban con filtros y polling, alta manual de pedido, pantalla tablet/TV con pairing y auto-ocultado, deploy en producción con HTTPS real y CI/CD. 75 tests de backend + verificación end-to-end con Playwright en cada tarea (dev y, para la 22, contra producción real).

  **Implementado, no estaba en la spec original** (agregado porque hizo falta, no por scope creep):
  - API de `Customer` completa (list + create) -- el alta manual de pedidos no funciona sin poder buscar/crear clientes.
  - CORS en el backend -- ninguna tarea anterior a la 16 había probado la API desde un browser real.
  - Documentación de API con drf-spectacular (`/api/docs/`, `/api/schema/`) -- tarea 18b, agregada a pedido explícito entre la 18 y la 19.
  - Mecanismo de pairing por código + `DeviceTokenAuthentication` -- la spec asumía que la pantalla no necesitaba backend nuevo; en la práctica fue el bloque de trabajo más grande de la Etapa 7.

  **En la spec, no implementado** (deferido a Fase 2 o dejado como deuda técnica conocida, no silenciado):
  - Webhooks salientes (`order.status_changed`, `order.created`, `stock.unavailable`) -- sin consumidor real hasta que exista el bot.
  - Service worker con cache real de pedidos para sobrevivir cortes de wifi en la pantalla del local -- quedó el service worker mínimo de la tarea 15, sin estrategia de cache.
  - Notificación real al cliente al marcar "sin stock" -- el botón dispara la transición de estado real, pero no hay bot que le escriba al cliente todavía.

  **Decisiones de infraestructura que se desviaron de lo planeado**: Next.js reemplazó a Vite+React (versión de Next mucho más nueva de lo esperado, sin `next-pwa` disponible), polling reemplazó a WebSocket, y el deploy terminó compartiendo la instancia EC2 con La Balanza (aislado por contenedores) en vez de una instancia separada. Las tres están documentadas en el lugar correspondiente de `docs/spec.md` (secciones 3.5, 3.6, 6, 7) en el momento en que se tomó cada decisión, no reconstruidas después.

  **Aprobado por el usuario para pasar a Fase 2**: sí.

---

# Fase 2 — Bot de WhatsApp (texto)

Basado en `docs/plan.md` (Fase 2). Alcance: integración con Meta Cloud API + agente con tools básicas (catálogo, crear pedido, consultar estado). Audio y el sistema completo de escalamiento con UI en el panel son Fase 3.

Decisiones confirmadas (ver `docs/plan.md`): `whatsapp-agent` en Node/TypeScript, Redis + worker desde el arranque, fallback genérico con log simple cuando el agente no puede resolver algo. **Proveedor de WhatsApp híbrido**: se desarrolla y prueba contra **WAHA** (no oficial, sin trámites) mientras se tramita Meta Business Verification; el core del bot no conoce el proveedor, habla con una interfaz (`WhatsAppProvider`) que cada uno implementa como adapter. Meta sigue siendo el destino final de producción (spec 4.3).

**Bloqueante externo, no depende de código**: una API key de Anthropic propia para que el bot llame a Claude en producción. Con WAHA no hace falta esperar a Meta para nada del desarrollo -- las tareas marcadas 🔒 son específicamente las que sí dependen de tener las credenciales de Meta Business.

### Etapa 9 — Order Core: lo que el bot necesita

- [x] **24. Info del tenant (horarios/ubicación/medios de pago)**
  Campos nuevos en `Tenant` (u modelo aparte si crece) + admin para cargarlos + endpoint de lectura.
  Hecho cuando: existe el campo/modelo, se puede cargar desde el admin, y hay un endpoint que lo devuelve.

- [x] **25. Autenticación de servicio para el bot**
  Modelo `BotToken` (tenant + token, sin flujo de pairing -- se genera directo, a diferencia de `PairingCode`) + `BotTokenAuthentication`, agregada puntualmente donde el bot necesita pegarle (catálogo, pedidos, info del tenant) -- mismo criterio que la tarea 21 con `DeviceTokenAuthentication`, no global.
  Hecho cuando: un token de bot puede leer catálogo/info y crear/consultar pedidos de su tenant, y no puede nada fuera de eso (tests de permisos, igual que la tarea 21).

### Etapa 10 — Servicio `whatsapp-agent`

- [x] **26. Setup del servicio**
  Proyecto Node/TypeScript en `whatsapp-agent/`, Dockerfile, CI (lint/test/build, mismo patrón que `order-core`).
  Hecho cuando: el servicio levanta local, CI en verde.

  Express (mínimo, solo lo justo para el webhook que llega en la tarea 29) + `tsx` para dev, `vitest`/`supertest` para tests, ESLint flat config con `typescript-eslint`. Un único endpoint `GET /health` por ahora (sirve también de healthcheck para Docker/Traefik más adelante). Dockerfile multi-stage (build compila TS, imagen final solo corre `dist/` con `node_modules --omit=dev`), mismo patrón de usuario no-root que `order-core/backend`. Job de CI nuevo en `.github/workflows/ci.yml`, mismo patrón que el de `frontend`.

- [x] **27. Redis**
  `docker-compose` para dev, cliente de conexión desde el servicio.
  Hecho cuando: el servicio se conecta a Redis local y puede encolar/leer un mensaje de prueba.

  Cliente oficial `redis` (node-redis v5), conexión lazy vía `getRedisClient()` (se conecta una sola vez, cacheada). `src/queue.ts`: `enqueue`/`dequeue` genéricos sobre una lista de Redis (`LPUSH`/`BLPOP`, JSON como formato de mensaje) -- todavía no es la cola específica de mensajes de WhatsApp, eso llega con la interfaz de la tarea 28. Test de integración contra Redis real (no mockeado), corre tanto local (`docker compose up -d`) como en CI (nuevo servicio `redis` en el job `whatsapp-agent`).

- [x] **28. Interfaz `WhatsAppProvider`**
  Mensaje entrante normalizado (independiente del formato de cada proveedor) + `sendMessage(telefono, texto)`. Selección de adapter activo por variable de entorno.
  Hecho cuando: la interfaz está definida y el resto del servicio (webhook, worker) programa contra ella, no contra un proveedor concreto.

  `src/providers/types.ts`: `IncomingMessage` (forma común) + `WhatsAppProvider` (`sendMessage`, `parseWebhookPayload` -- traduce el body crudo del webhook de cada proveedor a `IncomingMessage[]` --, y `verifyWebhook` opcional para la verificación por `GET`/`hub.challenge` que solo pide Meta). `src/providers/select.ts`: `selectProvider(nombre, registry)` puro, testeado con un registry falso -- no depende de que WAHA/Meta existan todavía. `src/providers/registry.ts`: `getActiveProvider()` real, lee `WHATSAPP_PROVIDER` del entorno contra un registry hoy vacío (se completa en las tareas 29 y 30). Nada usa `getActiveProvider()` todavía -- eso llega con el webhook de la tarea 29.

- [x] **29. Adapter WAHA**
  Webhook de recepción + envío, implementando la interfaz de la tarea 28. Se prueba con un número de WhatsApp propio, vía QR.
  Hecho cuando: un mensaje mandado desde un teléfono real (por WAHA) llega al webhook y queda encolado en Redis; el servicio puede mandar una respuesta de vuelta y llega al teléfono.

  `src/providers/waha.ts`: `sendMessage` vía `POST /api/sendText`, `parseWebhookPayload` traduce el evento `message` de WAHA (ignora `fromMe` y otros eventos como `message.ack`). Rutas nuevas en `app.ts`: `POST /webhooks/whatsapp` (encola en Redis vía `getActiveProvider().parseWebhookPayload`) y `GET /webhooks/whatsapp` (404 para WAHA, que no implementa `verifyWebhook` -- eso lo usa Meta en la tarea 30). WAHA se suma a `docker-compose.yml` para desarrollo (engine `NOWEB`, sin dependencia de Chromium).

  Verificado de punta a punta con un número real (línea de repuesto, WhatsApp Business, vía WAHA): mensaje mandado desde otro teléfono → llega al webhook → queda en la cola de Redis (`whatsapp:incoming-messages`) → se le mandó una respuesta real que el teléfono recibió. En el camino aparecieron tres problemas reales, documentados en el README del servicio para no repetirlos:
  - Un remitente con la privacidad de número activada (frecuente en cuentas Business) manda el `from` como `<id>@lid` en vez de `<telefono>@c.us` -- el código original le sacaba el sufijo asumiendo que siempre era un teléfono, lo cual iba a romper la respuesta. Se corrigió guardando el chatId completo en `IncomingMessage.from`.
  - La imagen de `devlikeapro/waha` cacheada localmente tenía casi un año -- con esa versión la sesión quedaba en loop de autenticación sin pasar nunca a `WORKING` (motor NOWEB tirando errores de protocolo). Se resolvió con `docker compose pull`.
  - `host.docker.internal` no llegó al proceso corriendo en la distro WSL2 en esta máquina -- se agregó `WAHA_HOOK_HOST` como variable de override para poder usar la IP real de la distro.

- [ ] **30. Adapter Meta Cloud API** 🔒
  `GET` de verificación (hub.challenge) + `POST` de recepción + envío vía Send Message API, mismo contrato que el adapter WAHA.
  Hecho cuando: con credenciales reales de Meta, la verificación del webhook responde lo que Meta espera y un mensaje real por Meta llega y se puede responder. Bloqueada hasta tener la cuenta de Meta Business verificada.

- [x] **31. Worker**
  Consume la cola, orquesta el resto de los pasos (cliente Order Core, agente, memoria, envío de respuesta) sin saber qué adapter está activo.
  Hecho cuando: un mensaje encolado (por cualquiera de los dos adapters) dispara el worker y se puede ver el flujo completo corriendo.

  `src/worker.ts`: `processNextMessage(handler, opciones)` -- saca un mensaje de la cola, lo pasa a un `handler` inyectado y manda la respuesta por `getActiveProvider().sendMessage()` (no sabe si es WAHA o Meta). `runWorker` es el loop infinito: un error del handler o un mensaje mal formado se loguea y sigue, no tira abajo el proceso. `src/worker-entry.ts` es el entrypoint (`npm run dev:worker` / `start:worker`), separado del servidor HTTP a propósito (spec/plan: el webhook responde rápido y encola, el worker procesa aparte) -- usa un `handler` placeholder ("recibimos tu mensaje...") hasta que exista el agente real (tarea 33), el cliente del Order Core (tarea 32) y la memoria (tarea 34).

  De paso, un bug real: `dequeue` hace `JSON.parse` sobre lo que sea que se encoló, así que `IncomingMessage.timestamp` volvía como string, no `Date` (el tipo mentía). `processNextMessage` lo reconstruye (`new Date(raw.timestamp)`) antes de pasarlo al handler.

  Verificado de punta a punta con mensajes reales: webhook → cola de Redis → worker → respuesta real recibida en el teléfono, con el servidor HTTP y el worker corriendo como dos procesos separados en paralelo.

- [x] **32. Cliente HTTP hacia el Order Core**
  Usa el `BotToken` de la tarea 25.
  Hecho cuando: el cliente puede traer catálogo/info del tenant y crear/consultar un pedido contra el Order Core real (dev).

  `src/order-core.ts`: `createOrderCoreClient(config)` (factory, mismo patrón que `createWahaProvider`) con `getCatalog`, `getTenantInfo`, `findCustomerByPhone`/`createCustomer`/`findOrCreateCustomer`, `createOrder` (fuerza `canal: "whatsapp"`), `getOrder`, `getOrdersByCustomerPhone`. `getOrderCoreClient()` resuelve `ORDER_CORE_URL`/`ORDER_CORE_BOT_TOKEN` del entorno en cada llamado, mismo criterio que `getActiveProvider()`.

  Verificado contra el Order Core real corriendo en dev (no solo mockeado): tenant + producto + `BotToken` de prueba creados vía `manage.py shell`, catálogo/info leídos, cliente creado y encontrado de nuevo sin duplicar, pedido creado con el precio congelado y releído por id y por teléfono del cliente -- todo con el cliente HTTP real de `whatsapp-agent`, no con `curl`. Datos de prueba limpiados al terminar.

- [x] **33. Agente con Claude (tool use)**
  Las 4 tools de la spec 4.1: catálogo, crear pedido, consultar estado, FAQ (horarios/ubicación/medios de pago).
  Hecho cuando: dado un mensaje de texto de prueba (vía WAHA, número propio), el agente elige la tool correcta y arma una respuesta coherente. Necesita la API key de Anthropic del bot -- esta sí es dependencia real, no bloqueada por Meta.

  **Modelo**: `claude-haiku-4-5` (decisión explícita del usuario) -- las 4 tools son acotadas (elegir entre 4 opciones, respuestas cortas en español), no ameritan un modelo más caro. Configurable por `ANTHROPIC_MODEL` si hace falta subir a Sonnet más adelante, sin tocar código.

  `src/agent.ts`: loop manual de tool use (no el tool runner beta del SDK, para no atar el proyecto a una API en beta por una necesidad tan simple) sobre 4 tools -- `ver_catalogo`, `crear_pedido`, `consultar_pedidos`, `info_local` -- que llaman al `OrderCoreClient` de la tarea 32. `runAgent` recibe el cliente de Anthropic como parámetro inyectable para poder testear sin pegarle a la API real. Tope de 6 turnos de tool-use antes de devolver una respuesta genérica (evita loops infinitos). `src/worker-entry.ts` usa `runAgent` como `handler` del worker -- el `catch` genérico ahí es provisorio, el fallback "de verdad" con log estructurado es la tarea 35.

  Verificado de punta a punta con la API de Anthropic real (no mockeada) y el Order Core real: catálogo consultado y mostrado correcto (filtrando `disponible=false`), pedido creado de punta a punta por WhatsApp real (WAHA, número de prueba) y confirmado con id real en el Order Core.

  Dos problemas reales encontrados en la prueba en vivo, no en tests:
  - **El system prompt inicial no alcanzaba.** Un typo del usuario ("capitulo" en vez de "catalogo") hizo que el agente contestara sobre series/películas con conocimiento general en vez de redirigir -- listar las 4 tools no le puso un límite de scope. Se corrigió agregando al prompt que no es un asistente de propósito general y que ante un mensaje ambiguo tiene que preguntar, no adivinar. Ver el gotcha completo en el README del servicio.
  - **Sin memoria (todavía) cada mensaje es una conversación nueva** -- el usuario lo notó como que el bot "no se acordaba" de haber dicho que quería pedir chipa un mensaje antes. Es el comportamiento esperado hasta la tarea 34 (memoria corta por `customer_phone`), no un bug de esta tarea.

- [x] **34. Memoria corta por `customer_phone`**
  Contexto de conversación, ligado al teléfono del cliente.
  Hecho cuando: dos mensajes seguidos del mismo teléfono comparten contexto (ej. "dame 2" después de "quiero chipa" arma bien el pedido).

  Se sumó algo que no estaba en el desglose original, a pedido explícito del usuario: **debounce de mensajes**. Es común que alguien mande una idea en 2-3 mensajes cortos seguidos por WhatsApp en vez de uno solo ("quiero" / "2 chipas") -- sin agrupar esos mensajes, el bot podía terminar contestando a mitad de frase. `src/debounce.ts` junta mensajes del mismo remitente durante una ventana (`MESSAGE_DEBOUNCE_MS`, default 6000ms, decisión explícita del usuario) antes de invocar al agente, con un buffer en memoria del proceso (alcanza con un solo worker, no hay réplicas todavía). `worker.ts` se ajustó para que un `handler` pueda devolver `""` sin que eso mande un WhatsApp vacío -- lo usa `debounce()` para señalar "todavía no hay respuesta, la mando yo cuando termine la ventana".

  `src/memory.ts`: los últimos 10 turnos (20 mensajes) de cada conversación en Redis, con TTL (`MEMORY_TTL_SECONDS`, default 30 min -- "memoria *corta*", no historial permanente). `runAgent` (tarea 33) ahora acepta `options.history` y lo antepone al mensaje nuevo. `worker-entry.ts` compone `debounce(handleMessage)`, donde `handleMessage` trae el historial, llama al agente, y guarda el turno resultante.

  Verificado de punta a punta con WhatsApp real: "quiero chipa" y "dame 2" mandados por separado (~22s de diferencia, más que el debounce -- o sea dos turnos distintos, no un solo batch) resultaron en un pedido de 2 Chipa creado correctamente en el Order Core real, confirmando que la memoria conectó ambos turnos. El usuario confirmó que la experiencia de chat mejoró notoriamente contra la tarea 33 (antes "se olvidaba" de lo dicho un mensaje antes).

- [ ] **35. Fallback genérico**
  Mensaje genérico al cliente + log estructurado simple cuando el agente no puede resolver algo (sin UI en el panel, eso es Fase 3).
  Hecho cuando: un mensaje fuera de alcance dispara el fallback y queda registrado en los logs del worker.

### Etapa 11 — Capa de IA (ampliación, spec adicional del 2026-08-08)

Ver `docs/plan.md` sección "Ampliación -- Capa de IA" para el contexto completo de esta ampliación y las decisiones de implementación (dónde viven las tablas nuevas, embeddings, ventana de 24hs). Todo lo de acá abajo corre sin depender de Meta -- solo las tareas 30 (ya existente) y 43 siguen bloqueadas.

- [x] **36. Tool `cancel_order`**
  Agrega la 5ta tool del Tool Engine (spec de la capa de IA): cancelar un pedido propio. Mismo patrón que las tools existentes (tarea 33) -- llama al Order Core, no inventa el resultado.
  Backend: acción `POST /api/orders/<id>/cancel/`, solo accesible al bot con `customer_phone` en el body (`OrderCancelSerializer`), que se valida contra el dueño real del pedido (`PermissionDenied` si no coincide) -- el bot no tiene noción de "cliente" en su auth, así que ese chequeo tiene que ir explícito acá, no alcanza con el token. No pasa por `DenyBotStatusChanges` (esa permission solo bloquea `status_transition`).
  Bug real encontrado en verificación en vivo (no en los 47 tests mockeados, que pasaban igual): el bot confirmaba la cancelación al cliente sin haber llamado nunca a la tool `cancelar_pedido` ni tocado el Order Core -- el pedido quedaba `pendiente` en la base mientras el bot decía "listo, cancelado". Se reprodujo primero por WhatsApp real, después con un script contra el `runAgent` real. Descartado que fuera un problema del modelo elegido en la tarea 33 (Haiku 4.5): en 8 corridas reales del loop completo, ~25-50% terminaban en una confirmación falsa -- y Sonnet 5 mostraba el mismo patrón en pruebas aisladas, así que no era cuestión de modelo sino de que el loop dejaba una puerta abierta para que el modelo respondiera con texto de "éxito" sin pasar por ninguna tool. Reforzar el system prompt (instrucción "CRÍTICO", ya en el prompt) no lo eliminó, y extended thinking lo redujo pero no lo sacó (todavía ~15% de corridas alucinaban).
  Fix real: se agregó una 6ta tool no-operativa `sin_accion` ("el mensaje no pide ninguna acción sobre el comercio") y se fuerza `tool_choice: {type: "any"}` en el primer turno de cada mensaje del cliente (`auto` en los turnos siguientes, una vez que ya hay al menos un resultado de tool en la conversación) -- así el modelo estructuralmente no puede saltar directo a un texto de "ya lo hice" sin pasar por una tool real (ni siquiera para saludos, que ahora pasan por `sin_accion` y recién en el segundo turno responden en texto libre).
  Hecho cuando: pedirle al bot cancelar un pedido propio lo cancela de verdad en el Order Core (queda en estado cancelado) y el bot lo confirma; no puede cancelar un pedido de otro cliente.
  Verificado con el fix aplicado: 11/11 corridas limpias (teléfono único por corrida, sin pedidos ambiguos acumulados) llamaron a la tool real y el pedido quedó `cancelado` en la base -- 0 confirmaciones falsas, contra ~25-50% antes del fix. Se comprobó también que no rompe: mensajes casuales ("hola", "gracias") siguen respondiendo natural vía `sin_accion`; el flujo de creación de pedido y el filtro de temas fuera de alcance (tarea 33) siguen funcionando; los 48 tests (47 + 1 nuevo que fija `tool_choice` por turno) y lint/typecheck pasan. Verificación final de punta a punta: conversación completa (crear pedido -> nada más -> cancelar) contra el Order Core real dejó el pedido en `cancelado`, y un intento de cancelar un pedido de otro cliente fue rechazado y el pedido ajeno quedó intacto en `pendiente`.

- [x] **37. Costo de IA logueado por conversación**
  Loguear tokens de entrada/salida (y costo estimado) de cada llamado a Claude, asociado al teléfono/conversación.
  `src/cost.ts`: tabla de precios USD por millón de tokens (Haiku 4.5, Sonnet 5, Opus 5, Fable 5 -- precios de agosto 2026, a mantener actualizada) + `estimateCostUsd(model, inputTokens, outputTokens)`, devuelve `null` si el modelo no tiene precio cargado en vez de romper el logging.
  `agent.ts`: `runAgent` acumula `input_tokens`/`output_tokens` de todos los turnos del loop (un mensaje del cliente puede disparar varios llamados a Claude si hay tools de por medio) y loguea una sola línea al final, asociada a `ctx.customerPhone`.
  Hecho cuando: después de una conversación de prueba, se puede ver en los logs del worker cuánto costó en tokens/USD.
  Verificado con una conversación real de 2 turnos: `[costo-ia] telefono=smoke-test-37 modelo=claude-haiku-4-5 input_tokens=3461 output_tokens=53 costo_usd=$0.003726`. 51 tests (2 nuevos de `cost.ts` + 1 de logging en `agent.test.ts`), lint y typecheck en verde.

- [ ] **38. LLM Router (clasificador + modelo principal)**
  Separar en dos llamados: uno barato clasifica la intención (consulta simple vs. algo que necesita razonar/tools) antes de decidir si hace falta el modelo principal -- ej. horarios/ubicación no deberían disparar el loop completo del agente.
  Hecho cuando: una consulta simple (ej. "a qué hora abren") se resuelve sin pasar por el loop completo de tool-use del modelo principal, verificado con el log de la tarea 37 (menos tokens que antes para ese tipo de consulta).

- [ ] **39. RAG Engine (pgvector + `knowledge_chunks`)**
  Extensión pgvector en el Postgres del Order Core, modelo `knowledge_chunks` (tenant-scoped) + pipeline de embeddings para contenido estático (políticas, FAQ largo). Antes hace falta un lugar para cargar ese contenido (no existe hoy, solo horarios/ubicación/medios de pago cortos de la tarea 24) -- carga manual por admin de Django, sin panel todavía.
  Hecho cuando: una pregunta sobre contenido estático cargado (ej. una política del local) se responde con datos reales recuperados por RAG, no alucinados ni por conocimiento general del modelo.

- [ ] **40. Memoria en Postgres con resumen + estado**
  Reemplaza la memoria en Redis de la tarea 34 por `conversations` + `messages` en el Order Core (mismo Postgres, tenant-scoped), con resumen corriente (para no reenviar todo el historial en cada turno) y estado de la conversación (ej. esperando confirmación de pedido).
  Hecho cuando: una conversación de prueba larga (más mensajes de los que entrarían enteros en el contexto) sigue teniendo sentido gracias al resumen, y el estado se puede consultar en el Order Core.

- [ ] **41. Escalamiento a humano completo**
  Reemplaza/extiende el fallback simple de la tarea 35: cuando el bot no puede resolver algo (baja confianza, fuera de alcance, cliente molesto), genera un resumen corto de la conversación (no el chat entero), marca la conversación con estado "requiere atención" visible en el panel/kanban existente, y le avisa al cliente que fue derivado sin cortar la conversación de forma abrupta.
  Hecho cuando: un mensaje fuera de alcance dispara la escalación, aparece en el panel con un resumen (no el historial crudo), y el cliente recibe el aviso de derivación.

### Etapa 12 — Deploy

- [ ] **42. Deploy de `whatsapp-agent`**
  Containers (agent + worker + redis) + ruta en Traefik para el webhook, mismo runner self-hosted que ya existe para este repo. Arranca con el adapter WAHA activo.
  Hecho cuando: el webhook es alcanzable por HTTPS en un dominio/subdominio propio, y un pedido real se puede crear de punta a punta hablándole al bot por WhatsApp (número propio, vía WAHA).

- [ ] **43. Migrar a Meta Cloud API en producción** 🔒
  Cambiar el adapter activo de WAHA a Meta por variable de entorno, sin tocar código.
  Hecho cuando: un mensaje real de WhatsApp (número de Business verificado) dispara todo el flujo y el cliente recibe una respuesta coherente, incluyendo al menos un pedido creado de punta a punta. Bloqueada hasta tener la cuenta de Meta Business verificada.

---

## Cómo seguir

Fase 1: arrancamos por la tarea 1, una por vez. Después de validar las tareas de la Etapa 2 (4 a 7d) a mano, se soltaron varias tareas seguidas de una.

Fase 2: mismo criterio -- de a una, empezando por la tarea 24. Casi todo se puede construir y probar en real contra WAHA (número propio) sin esperar nada de Meta -- las únicas tareas realmente bloqueadas (🔒, tareas 30 y 43) son las que dependen de tener la cuenta de Meta Business verificada.

Ampliación del 2026-08-08: se sumaron las tareas 36-41 (capa de IA -- Tool Engine completo, Router de 2 niveles, RAG, memoria en Postgres, escalamiento con panel), a pedido explícito del usuario tras revisar una spec aparte. Deploy y migración a Meta se renumeraron de 36/37 a 42/43 para que las tareas nuevas queden antes en el orden de ejecución (tiene sentido tener las features completas antes de deployar, no al revés).
