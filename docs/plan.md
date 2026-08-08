# Plan — Fase 2: Bot de WhatsApp (texto)

Basado en `docs/spec.md` secciones 2, 4 y 6-8. Alcance según sección 7: **integración con Meta Cloud API + agente con tools básicas (catálogo, crear pedido, consultar estado)**. Explícitamente fuera de esta fase (son Fase 3): transcripción de audio, y el sistema completo de escalamiento a humano con UI en el panel ("requiere atención"). Sin escribir código todavía — esto es para acordar antes de pasar a `docs/tasks.md`.

## Qué ya existe y qué no

El Order Core (Fase 1) ya expone todo lo que el bot necesita *leer/escribir* en principio: `GET /catalog`, `POST /orders`, `GET /orders/{id}`, `PATCH /orders/{id}/status`. Lo que **no existe todavía** y esta fase tiene que resolver:

1. **Cómo se autentica el bot contra el Order Core.** Hoy hay dos mecanismos: JWT de staff (`TenantAwareJWTAuthentication`, pensado para un humano logueado) y `DeviceTokenAuthentication` (pensado para la pantalla, de solo lectura y solo en `/api/orders/`). Ninguno sirve para "un servicio de confianza que actúa en nombre de un tenant, con permiso de leer catálogo y crear/consultar pedidos". Hace falta un mecanismo nuevo -- mismo tipo de trabajo que fue el pairing de la tarea 21, pero más simple (no hay "pairing", el bot es un servicio, no un dispositivo que un humano empareja).
2. **De dónde salen horarios / ubicación / medios de pago.** La spec (4.1, punto 3) pide que el bot pueda responder esto, pero no hay ningún modelo en el Order Core que guarde esa info por tenant. Hace falta agregar algo mínimo (unos campos en `Tenant`, o un modelo aparte tipo `TenantInfo`).
3. **Memoria corta de la conversación por `customer_phone`.** No hay ningún storage para esto todavía.
4. **El servicio `whatsapp-agent` en sí.** No existe ni el directorio. La spec (sección 8) dice que va en el mismo monorepo que `order-core`, como servicio aparte que habla con el Order Core por HTTP.

## Decisiones (confirmadas)

1. **Proveedor de WhatsApp: híbrido.** Meta Cloud API sigue siendo el destino final (spec 4.3, sin cambios) -- pero mientras se tramita la verificación de Meta Business (puede tardar), se desarrolla y prueba contra **WAHA** (WhatsApp HTTP API, no oficial, login por QR con un número de prueba propio, sin trámites). Para que el cambio de proveedor no implique reescribir el bot, el core (webhook → cola → worker → agente) no habla con "Meta" ni con "WAHA" directamente: habla con una interfaz chica (`WhatsAppProvider`, algo como `sendMessage(telefono, texto)` + un formato normalizado de mensaje entrante), y cada proveedor es un adapter que implementa esa interfaz. Se selecciona por variable de entorno. Esto no es abstracción prematura: ya sabemos que van a existir dos proveedores concretos, no es una hipótesis.
   - Sigue pendiente, dependencia externa real: API key de Anthropic propia para que el bot llame a Claude en producción (aparte de esta sesión de Claude Code) -- sin esto no hay tools reales que probar, ni con WAHA ni con Meta.
2. **Lenguaje del servicio `whatsapp-agent`**: **Node/TypeScript**.
3. **Arquitectura del webhook**: **Redis + worker desde el arranque**, como sugiere la spec -- el webhook encola el mensaje entrante y responde rápido a Meta; un worker aparte lo procesa (llama a Claude, llama al Order Core, manda la respuesta). Implica sumar un container de Redis al server (recursos: a vigilar, el box ya corre ajustado de RAM).
4. **Fallback cuando el agente no puede resolver algo**: mensaje genérico al cliente ("no tengo esa información, un operador te va a escribir") + queda registrado en algún lado simple (ver desglose, punto 10) para que el operador lo vea. Sin UI en el panel todavía -- eso es Fase 3.

## Desglose de piezas (orden sugerido, no es tasks.md todavía)

**Backend (Order Core)**
1. Modelo + campos para horarios/ubicación/medios de pago por tenant.
2. Mecanismo de autenticación para el bot (nueva auth class, similar en espíritu a `DeviceTokenAuthentication` pero para un servicio, no un dispositivo pareado por humano).
3. Endpoint(s) que el bot necesite y que hoy no existan (a confirmar una vez resueltos los puntos de arriba -- probablemente ninguno nuevo además de lo ya construido, salvo el de horarios/ubicación).

**Servicio nuevo `whatsapp-agent`**
4. Setup del servicio (estructura Node/TypeScript, Dockerfile, CI).
5. Redis: infra local (dev) + producción, cola de mensajes entrantes.
6. Interfaz `WhatsAppProvider` (mensaje normalizado + `sendMessage`) y selección de adapter por env var.
7. Adapter WAHA: webhook de recepción + envío -- este es el que se prueba primero, sin esperar a Meta.
8. Adapter Meta Cloud API: verificación de webhook (`GET`, hub.challenge) + recepción (`POST`) + envío (Send Message API) -- mismo contrato que el adapter WAHA, se prueba cuando estén las credenciales. 🔒
9. Worker: consume la cola, orquesta el resto (pasos 10-12), sin saber qué adapter está activo.
10. Cliente HTTP hacia el Order Core (autenticado con el mecanismo del punto 2 del backend).
11. Agente con Claude (tool use): las 4 tools de la spec 4.1.
12. Memoria corta por `customer_phone` (¿en Redis también, o storage aparte? -- a definir en la tarea correspondiente).
13. Fallback genérico cuando el agente no puede resolver algo, con registro simple (logs estructurados alcanza para Fase 2 -- una vista en el panel es Fase 3).

**Deploy**
14. Containers (agent + worker + redis) + ruta en Traefik para el webhook (mismo patrón que Fase 1, mismo runner self-hosted -- no hace falta uno nuevo, es el mismo repo). Arranca con el adapter WAHA activo; se cambia a Meta por variable de entorno cuando estén las credenciales, sin redeploy de código.
15. Tests + verificación end-to-end -- con WAHA primero (no bloqueante), con Meta después (🔒, cuando tengas las credenciales).

## Siguiente paso

Con las 4 decisiones ya confirmadas, el siguiente paso es convertir este plan en `docs/tasks.md` (checklist ejecutable, una tarea por commit). Lo hago ahora salvo que quieras ajustar algo del desglose primero.

---

## Ampliación — Capa de IA (LLM Router + RAG + Tool Engine)

El usuario trajo una spec aparte para una "capa de IA" más completa (Router de 2 niveles, RAG con pgvector, memoria conversacional en Postgres con resumen/estado, escalamiento a humano con resumen + kanban, ventana de 24hs de Meta, costo logueado). Comparada con lo ya construido (tareas 24-34): el Tool Engine y la autenticación del bot ya existen en espíritu; memoria hoy es más simple (Redis, últimos 10 turnos, sin resumen ni estado); no hay Router de 2 niveles (un solo llamado a Haiku hace todo); no hay RAG; el escalamiento es el fallback simple de la tarea 35, sin panel.

**Decisión (2026-08-08)**: se suma a Fase 2 todo lo que **no dependa de credenciales de Meta** -- o sea, todo excepto las tareas 30 y 37 (adapter Meta / migración a producción), que siguen bloqueadas. Se descarta la lectura inicial de "esto es Fase 3": la única pieza que realmente coincidía con lo ya deferido a Fase 3 (escalamiento con panel) se suma también, a pedido explícito.

**Decisiones de implementación (para no dejarlas implícitas):**
- Las tablas nuevas (`conversations`, `messages`, `knowledge_chunks`, `escalations`) viven en el **Order Core** (mismo Postgres, mismo patrón de scoping por tenant que todo lo demás), no en una base aparte para `whatsapp-agent` -- consistente con "el bot habla con el Order Core por HTTP", no con una base propia. Se exponen vía `BotTokenAuthentication` (tarea 25), mismo criterio que catálogo/pedidos.
- Embeddings: dependencia externa nueva (proveedor de embeddings + su propia API key), a resolver en la tarea de RAG -- no asumir cuál todavía.
- Contenido estático para indexar (políticas, FAQ largo): hoy `Tenant` solo tiene horarios/ubicación/medios de pago (campos cortos, tarea 24). Antes de armar RAG hace falta un lugar para cargar contenido más largo -- se resuelve en la tarea de RAG, carga manual (admin de Django), sin panel de carga (eso sí queda para más adelante).
- Ventana de 24hs de Meta: como hoy estamos en WAHA (sin restricción de template), esta pieza queda como diseño/campo preparado (guardar `último_mensaje_at` por conversación) pero sin lógica de bloqueo real -- se activa de verdad recién en la tarea 37 (Meta), que sigue bloqueada.

Desglose convertido a tareas nuevas en `docs/tasks.md`: la 35 (fallback genérico) queda igual; se suman las tareas 36-41; deploy y migración a Meta se renumeran de 36/37 a 42/43 (no se había ejecutado ninguna de las dos todavía, no hay nada que romper).
