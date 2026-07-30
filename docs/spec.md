# Mostrador
## Gestor de Pedidos Multi-Rubro + Bot de WhatsApp con IA
### Especificación técnica (v0.1 — para desarrollo con Claude Code)

---

## 1. Visión y alcance

Un sistema de gestión de pedidos **independiente del rubro**, compuesto por dos módulos que pueden vivir juntos o desacoplados:

- **Núcleo de pedidos (Order Core)**: backend + panel interno para que el dueño/operador del negocio vea y gestione el ciclo de vida de cada pedido.
- **Bot de WhatsApp con IA**: atiende clientes por WhatsApp (texto o audio), responde preguntas, toma pedidos y gestiona todo el flujo sin intervención humana salvo excepciones.

Debe poder usarse:
- **Standalone**, para cualquier emprendimiento (ej. chipacitos).
- **Integrado a La Balanza**, como fuente de catálogo/stock/precios para carnicerías, sin duplicar esa lógica.

Diseño clave: el Order Core **no sabe nada de carne ni de balanzas**. Solo sabe de "productos", "stock" y "pedidos". La Balanza es un *proveedor de catálogo* más, igual que lo sería un negocio que carga su catálogo a mano.

---

## 2. Arquitectura general

```
┌─────────────────────┐        ┌──────────────────────┐
│   Panel Interno      │◄──────►│                       │
│   (admin web)         │        │      ORDER CORE       │
└─────────────────────┘        │  (API + estado de      │
                                 │   pedidos, clientes,   │
┌─────────────────────┐        │   catálogo local)      │
│   Bot de WhatsApp     │◄──────►│                       │
│   (agente IA)          │        └───────────┬───────────┘
└─────────┬───────────┘                        │
          │                          Webhook / API Key
          ▼                                    ▼
┌─────────────────────┐        ┌──────────────────────┐
│  Proveedor WhatsApp   │        │   La Balanza (opc.)   │
│  (Meta Cloud API /     │        │   catálogo/stock/     │
│   Evolution API)       │        │   precios por tenant   │
└─────────────────────┘        └──────────────────────┘
```

Dos servicios separados que se hablan por API/webhooks: **order-core** y **whatsapp-agent**. Esto permite vender o instalar solo uno de los dos si hace falta, y que La Balanza sea un integrador más del Order Core, no su dueño.

---

## 3. Sistema A — Order Core (backend + panel interno)

### 3.1 Modelo de dominio

- **Tenant**: `id`, `nombre`, `slug`, `plan`, `created_at`.
- **User**: `id`, `tenant_id`, `email`, `password_hash`, `rol` (admin/empleado), `nombre`. Implementado extendiendo `AbstractUser` de Django en vez de un modelo desde cero: en la práctica el modelo real también tiene `username` (login por username, no por email todavía) y el hasheo de password lo resuelve Django por herencia (`password`, no un campo `password_hash` literal) — decisión de implementación de la tarea 5, no un desvío funcional.
- **Customer**: `id`, `tenant_id`, `telefono` (único por tenant, es el ID de WhatsApp), `nombre`, `created_at`.
- **Product**: `id`, `tenant_id`, `nombre`, `precio`, `unidad`, `disponible` (bool), `origen` (manual/integración), `external_id` (nullable, para mapear con La Balanza u otra integración).
- **Order**: `id`, `tenant_id`, `customer_id`, `canal` (whatsapp/manual), `estado`, `notas`, `created_at`, `updated_at`.
- **OrderItem**: `id`, `order_id`, `product_id`, `cantidad`, `precio_unitario_snapshot` (se copia el precio al momento del pedido, no se referencia el precio actual del producto).
- **OrderEvent**: `id`, `order_id`, `estado_anterior`, `estado_nuevo`, `actor` (user_id / "bot" / "sistema"), `created_at` — auditoría completa de cada pedido.

### 3.2 Máquina de estados del pedido

```
pendiente → confirmado → en_preparación → listo → 
   → entregado (retiro en local)
   → en_camino → entregado (delivery)

Estados alternativos: cancelado, sin_stock, rechazado
```

Cada transición dispara un evento (para notificar al cliente por WhatsApp y actualizar el panel en tiempo real).

Implementado en `orders/state_machine.py`. La spec no detalla desde qué estados se puede llegar a los tres alternativos, así que se definió así: `cancelado` es alcanzable desde cualquier estado no terminal (pendiente/confirmado/en_preparación/listo/en_camino); `rechazado` y `sin_stock` solo desde pendiente/confirmado (antes de que el pedido entre en preparación). Pendiente de revisar en Fase 2: hoy `en_camino → cancelado` es una cancelación simple sin motivo obligatorio; si el bot empieza a disparar cancelaciones automáticas, o aparece lógica de reembolso/costo de envío ya gastado, probablemente necesite más que un cambio de estado liso.

### 3.3 API pública (para el bot y para integraciones)

Endpoints mínimos:
- `GET /catalog` — productos disponibles (puede delegar a integración externa)
- `POST /orders` — crear pedido
- `GET /orders/{id}` — estado de un pedido
- `PATCH /orders/{id}/status` — cambiar estado
- `GET /orders?customer_phone=` — historial de un cliente
- Webhooks salientes: `order.status_changed`, `order.created`, `stock.unavailable`

**Estado real al cierre de Fase 1**: todo lo de arriba está implementado, más filtros extra en `GET /orders` (por `estado`, `canal`, `customer`, `fecha`) y CRUD completo de `Product`/`Customer` (`Customer` terminó haciendo falta para el alta manual de pedidos y no estaba en la lista original). Los **webhooks salientes NO están implementados** — no hay todavía ningún consumidor real (el bot, que los necesitaría, es Fase 2), así que se deferieron en vez de construirlos sin caso de uso. Quedan pendientes para cuando arranque la Fase 2.

La API completa queda documentada automáticamente vía `drf-spectacular`: esquema OpenAPI en `/api/schema/`, Swagger UI navegable en `/api/docs/` (públicos, sin login, para que se puedan explorar/probar).

### 3.4 Panel interno

- Vista tipo tablero (kanban) por estado de pedido. Implementado con 6 columnas (el flujo principal: pendiente, confirmado, en_preparación, listo, en_camino, entregado) -- los 3 estados alternativos (cancelado, sin_stock, rechazado) no tienen columna propia, se accede a ellos vía acción puntual (ver siguiente punto) en vez de drag & drop.
- Filtro por canal, por cliente, por fecha.
- Marcar "sin stock" dispara automáticamente una respuesta del bot al cliente. **Implementado como placeholder**: el botón dispara la transición de estado real (`PATCH /orders/{id}/status` a `sin_stock`, con su `OrderEvent`), pero todavía no hay ningún bot que reciba ese evento y le escriba al cliente -- eso depende de la Fase 2.
- Notificaciones en tiempo real (WebSocket o polling corto) → **polling** (decisión de Fase 1, ver sección 6).

### 3.5 Pantalla de estado en local (modo "tablet/TV")

Vista adicional, separada del panel de gestión, pensada para mostrarse en una tablet o TV dentro del local (estilo pantalla de pedidos de McDonald's):

- Solo lectura, sin login (con pairing por código numérico de 6 dígitos para vincular el dispositivo al tenant -- se implementó solo la variante código, sin QR).
- Tipografía grande, columnas por estado, pensada para verse a distancia. Implementado con **4 columnas**, no 3: en preparación / listo / en camino / **entregado** -- hace falta una columna "entregado" para que el punto siguiente (auto-ocultado) tenga algo que ocultar; sin ella el pedido desaparecería de golpe al pasar a entregado en vez de mostrarse un rato y disolverse solo.
- Se actualiza sola en tiempo real (mismo canal WebSocket que el panel interno, distinta vista) → **polling** cada 5s, mismo mecanismo que el panel (ver sección 6).
- Filtra automáticamente pedidos ya entregados/retirados (los saca de pantalla después de un tiempo configurable). Implementado: 60 segundos, como constante en el código -- "configurable" hoy significa que existe una única constante fácil de cambiar, no un control en la UI para ajustarlo en runtime.
- ~~Técnicamente es solo otra ruta del frontend del Order Core consumiendo la misma API — no requiere backend aparte.~~ **Esto no se cumplió**: el pairing sin login sí necesitó backend nuevo -- un modelo `PairingCode` (código + token de dispositivo), un endpoint para generarlo (`POST /api/pairing/generate/`, desde el panel) y uno para canjearlo (`POST /api/pairing/claim/`, sin auth), y una clase de autenticación nueva (`DeviceTokenAuthentication`, header `Authorization: DeviceToken <token>`, agregada solo en el endpoint de pedidos -- de solo lectura ahí, no en el resto de la API). Fue el bloque de trabajo más grande de la Etapa 7.

---

### 3.6 Arquitectura frontend: PWA

El frontend de Mostrador (panel interno + pantalla tablet, sección 3.5) se construye como una **única PWA** en Next.js + TypeScript, en vez de apps nativas separadas:

- Mismo código Next.js, distintas rutas: `/panel` (gestión, requiere login) y `/pantalla` (solo lectura, pairing por código).
- Instalable desde el navegador (manifest + service worker), sin pasar por tiendas de apps — clave si el producto se instala en el dispositivo de un tercero.
- Service worker cachea el último estado conocido de los pedidos, para que la pantalla del local no se rompa ante un corte breve de wifi. **No implementado al cierre de Fase 1**: las tareas 19-21 se cerraron con el service worker mínimo de la tarea 15 (sin estrategia de cache), no se volvió a esto. Queda como deuda técnica conocida a retomar si el corte de wifi resulta un problema real en el uso del local.
- Deploy (tarea 22): se exporta como sitio estático (`output: "export"`), sin proceso Node corriendo en producción -- todas las páginas son client components que hacen fetch a la API por su cuenta, sin nada server-side (route handlers, server actions, cookies), así que no hace falta un runtime de Node para servirlo. Se sirve con nginx, igual que cualquier SPA.
- No se usa `next-pwa`: al implementar la tarea 15 (julio 2026) la versión instalada de Next.js (16) ya trae soporte nativo de manifest (`app/manifest.ts`) y la guía oficial de PWA de esa versión recomienda **Serwist** como sucesor de `next-pwa` para el service worker — con la salvedad de que Serwist necesita configuración de webpack, mientras que Next 16 usa Turbopack por default. Se optó por un `public/sw.js` mínimo escrito a mano (sin estrategia de cache, solo lo necesario para que el navegador ofrezca instalar la PWA) — ver el punto de arriba sobre por qué esto se quedó así al cierre de la Fase 1.
- Limitación a tener en cuenta: soporte de PWA en iOS es más acotado que en Android/Chrome (push notifications, background sync). No es un problema para la pantalla fija del local (probablemente tablet Android), pero sí a evaluar si en el futuro se piensa un uso más "app" para el dueño desde su celular.

### 4.1 Flujo de mensajes

1. Mensaje entrante (texto o audio) vía proveedor de WhatsApp.
2. Si es audio → transcripción (Whisper o similar).
3. El texto resultante entra a un **agente con Claude** que tiene *tools* (function calling) para:
   - Consultar catálogo (`GET /catalog`)
   - Crear pedido (`POST /orders`)
   - Consultar estado de pedido (`GET /orders/{id}`)
   - Responder preguntas frecuentes (horarios, ubicación, medios de pago)
4. El agente mantiene contexto de la conversación por cliente (memoria corta, ligada al `customer_phone`).
5. Si el agente no puede resolver algo (ambigüedad grave, reclamo, pedido especial fuera de catálogo) → **escala a un humano** marcando la conversación como "requiere atención" en el panel.

### 4.2 Reglas de escalamiento a humano

Definir explícitamente (esto es una decisión de producto clave, no solo técnica):
- Reclamos o quejas.
- Pedidos con requerimientos no soportados por el catálogo.
- Cuando el cliente pide hablar con una persona.
- Fallos repetidos de comprensión (ej. 2+ intentos fallidos sobre lo mismo).

### 4.3 Proveedor de WhatsApp

Opciones a evaluar en la spec de implementación:
- **Meta WhatsApp Cloud API** (oficial, requiere Business verificado, más estable a largo plazo).
- **Evolution API / Baileys** (no oficial, más rápido para arrancar, riesgo de baneo).

Para un producto que se va a vender a terceros, conviene planificar directamente sobre la API oficial aunque el arranque sea más lento.

---

## 5. Integración con La Balanza

- La Balanza actúa como un "conector de catálogo" para tenants que la usan.
- Se define una interfaz simple: `GET /integrations/la-balanza/products?tenant_id=` devuelve productos y stock en el formato que espera el Order Core.
- El resto de los tenants (ej. chipacitos, verdulería) cargan su catálogo directo en el Order Core sin pasar por La Balanza.

---

## 6. Stack sugerido

Reutilizar lo ya probado en La Balanza para bajar riesgo, modernizando el frontend:
- **Order Core (backend)**: Django + DRF + PostgreSQL (multi-tenant por `tenant_id`). Se mantiene sobre Django porque ya está resuelto el patrón multi-tenant en otros proyectos y da admin gratis — cambiarlo ahora sería riesgo especulativo sin necesidad real.
- **Frontend**: Next.js + TypeScript + Tailwind, en vez de Vite+React plano — tipado real en los contratos con la API. PWA con soporte nativo de Next.js (sin `next-pwa`, ver sección 3.6 para el detalle de por qué).
- **WhatsApp Agent**: servicio aparte (Node/TypeScript o Python, a definir en Fase 2), Claude API con tool use, cola de mensajes (Redis/simple queue). Se comunica con el Order Core por HTTP, no comparte código — por eso el lenguaje del Order Core no condiciona al del bot.
- **Infra**: AWS, mismo esquema que La Balanza — EC2 + Traefik + GitHub Actions, PostgreSQL en Docker en la misma instancia. RDS se evalúa más adelante, cuando haya carga real o un cliente pagando que justifique el costo de un servicio administrado con backups/Multi-AZ. La instancia EC2 es la misma que ya usa La Balanza (dev server compartido) — "infra separada" (sección 8) se resolvió como aislamiento por contenedores + ruteo por dominio en Traefik, no como una instancia física aparte; ver sección 7, tarea 22.

---

## 7. Roadmap por fases

**Fase 1 — MVP Order Core standalone — ✅ completa**
- Modelo de datos, API, panel kanban, pantalla tablet/TV, deploy en producción. Sin bot todavía (carga manual de pedidos), tal como se planeó.

El desglose granular de tareas (23 en total, una por commit) y su estado vive en `docs/tasks.md` — no se duplica acá para no mantener dos listas desincronizadas. Resumen de las desviaciones/decisiones más relevantes tomadas durante la ejecución (detalle en las secciones correspondientes de este documento):
- Next.js en vez de Vite+React, sin `next-pwa` (no aplica a la versión de Next usada) — sección 3.6.
- Polling corto en vez de WebSocket — sección 6.
- `Customer` API no estaba en la lista original de endpoints y terminó siendo necesaria — sección 3.3.
- Webhooks salientes no implementados (sin consumidor real hasta que exista el bot) — sección 3.3.
- Pairing de la pantalla sí necesitó backend nuevo, pese a que la spec asumía que no — sección 3.5.
- Service worker con cache real de pedidos (para sobrevivir cortes de wifi) no se implementó — sección 3.6.
- Infra de deploy compartida con La Balanza (misma instancia EC2, aislado por contenedores) en vez de una instancia física separada — sección 6.

**Fase 2 — Bot de WhatsApp (texto)**
- Integración con Meta Cloud API, agente con tools básicas (catálogo + crear pedido + consultar estado).

**Fase 3 — Audio + escalamiento**
- Transcripción de audios, reglas de escalamiento a humano, notificaciones al cliente por cambio de estado.

**Fase 4 — Integración La Balanza + multi-tenant real**
- Conector de catálogo, onboarding de un segundo rubro (ej. chipacitos) para validar que es genérico.

---

## 8. Estrategia de repositorio

**Repo separado de La Balanza, no monorepo compartido.** Motivos:

- Es un producto distinto, con su propio ciclo de vida, clientes potenciales y ritmo de releases — no querés que un deploy de La Balanza arrastre al gestor de pedidos ni viceversa.
- La Balanza es *un integrador más* del Order Core (como se ve en la sección 5), no su dueño. Mezclarlos en un mismo repo genera acoplamiento justo donde el diseño busca lo contrario.
- Si en algún momento lo licenciás o vendés a un tercero (ej. la verdulería, alguien con chipacitos), no querés exponer ni depender del código de La Balanza.

Dentro del *nuevo* proyecto sí tiene sentido un **monorepo propio** para `order-core` (backend + panel + pantalla tablet) y `whatsapp-agent`, ya que están fuertemente acoplados en su ciclo de desarrollo (comparten contratos de API que van a cambiar juntos en las primeras fases) y así evitás el overhead de versionar y sincronizar dos repos separados mientras todavía es un solo dev iterando rápido. Se puede separar en repos independientes más adelante si el proyecto crece o si `whatsapp-agent` termina teniendo un ritmo de cambio muy distinto.

## 9. Cómo avanzar con Claude Code (spec-driven)

Sugerencia de orden de trabajo:
1. Tomar la Fase 1 como spec inicial, aprobarla, y generar plan de tareas concreto con Claude Code.
2. Definir el modelo de datos y la API antes que el panel visual.
3. Recién en Fase 2 escribir la spec del agente de WhatsApp (las tools que expone el Order Core ya van a estar definidas y estables).
4. Mantener este documento como fuente de verdad y versionarlo a medida que cada fase se aprueba.

## 10. Paso a paso concreto (CLI o VS Code)

**Paso 0 — Preparar el repo**
```
mkdir gestor-pedidos && cd gestor-pedidos
git init
mkdir -p docs
# copiar este archivo a docs/spec.md
```

**Paso 1 — CLAUDE.md (contexto persistente)**
Crear un `CLAUDE.md` en la raíz con las convenciones fijas del proyecto (stack, estilo de commits, que siempre lea `docs/spec.md` antes de tocar código, que no avance de fase sin tu aprobación explícita). Esto Claude Code lo carga solo en cada sesión, así no tenés que repetirlo.

**Paso 2 — Generar el plan a partir de la spec**
- CLI: parado en la carpeta del repo, ejecutar `claude` y pedirle algo como: "Leé docs/spec.md, enfocate solo en la Fase 1, y generá un plan.md con el desglose de tareas en orden de ejecución, sin escribir código todavía."
- VS Code: igual, pero desde el panel de Claude Code de la extensión, referenciando `docs/spec.md` con `@`.
- Revisás `plan.md`, ajustás lo que no te cierre, y recién ahí lo aprobás.

**Paso 3 — Tareas ejecutables**
Pedirle que convierta `plan.md` en un `tasks.md` tipo checklist, una tarea por commit, con criterio de "hecho" claro en cada una (ej. "existe el modelo X con migración aplicada y test de scoping por tenant pasando").

**Paso 4 — Implementación incremental**
- Le pedís que arranque por la primera tarea de `tasks.md`, nada más.
- Revisás el diff/PR de esa tarea antes de decir "segui con la siguiente" — no le sueltes la mano a ejecutar todo `tasks.md` de una sin control, aunque el objetivo final sea que trabaje largo y tendido: los primeros checkpoints (modelo de datos, scoping multi-tenant, máquina de estados) conviene revisarlos a mano porque son la base de todo lo demás.
- Una vez que esas tareas base estén validadas, ahí sí podés soltarle varias tareas seguidas de una sola vez ("segui con las tareas 4 a 8 de tasks.md, commiteá cada una por separado").

**Paso 5 — Checkpoints por fase**
Al cerrar la Fase 1, le pedís un resumen de lo implementado vs. lo especificado en `docs/spec.md`, y actualizás la spec si algo cambió en el camino (para que quede como fuente de verdad real, no aspiracional).