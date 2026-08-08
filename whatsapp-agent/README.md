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
Adapter WAHA implementado (tarea 29); Meta todavía no (tarea 30).

`src/worker.ts` es el otro proceso (tarea 31): consume `whatsapp:incoming-messages`
(la cola de Redis donde el webhook deja los mensajes), llama a un `handler`
y manda la respuesta por el proveedor activo -- no sabe si el mensaje vino
de WAHA o de Meta. Corre separado del servidor HTTP a propósito (ver
`docs/plan.md`, decisión 3: el webhook responde rápido y encola, el worker
procesa aparte).

`src/order-core.ts` (tarea 32) es el cliente HTTP hacia el Order Core
(`order-core/backend`), autenticado con el `BotToken` de la tarea 25
(header `Authorization: BotToken <token>`, variables `ORDER_CORE_URL` /
`ORDER_CORE_BOT_TOKEN`). Cubre lo que las tools del agente necesitan:
catálogo, info del tenant, buscar/crear cliente por teléfono, y
crear/consultar pedidos (`canal` se fuerza a `"whatsapp"`, cambiarle el
estado a un pedido no es una tool del bot -- ver `DenyBotStatusChanges` del
lado del Order Core).

`src/agent.ts` (tarea 33) es el agente con Claude (`ANTHROPIC_MODEL`, por
default `claude-haiku-4-5` -- las 4 tools son acotadas, no hace falta un
modelo más caro para elegir cuál usar). Loop manual de tool use (`while
stop_reason === "tool_use"`) sobre 4 tools -- `ver_catalogo`,
`crear_pedido`, `consultar_pedidos`, `info_local` -- que llaman al cliente
del Order Core.

`src/memory.ts` (tarea 34) guarda los últimos 10 turnos de cada
conversación en Redis, con TTL (`MEMORY_TTL_SECONDS`, default 30 min --
"memoria corta": una charla inactiva se olvida sola). `src/debounce.ts`
(misma tarea) agrupa mensajes seguidos del mismo remitente durante una
ventana (`MESSAGE_DEBOUNCE_MS`, default 6000ms) antes de invocar al agente
-- es común que alguien mande una idea en 2-3 mensajes cortos por
WhatsApp en vez de uno solo, y sin esto el bot podía contestar a mitad de
frase. Buffer en memoria del proceso (no en Redis): alcanza con un solo
worker, no hay réplicas todavía (ver tarea 36).

`src/worker-entry.ts` compone `debounce(handleMessage)` como `handler` del
worker -- `handleMessage` trae el historial de `memory.ts`, llama a
`runAgent`, y guarda el turno nuevo. El `catch` genérico ahí es
provisorio, el fallback "de verdad" con log estructurado es la tarea 35.

## Desarrollo local

```bash
cp .env.example .env          # ajustar valores si hace falta
docker compose up -d          # levanta Redis + WAHA

npm install
npm run dev         # servidor HTTP (webhook), puerto 3000
npm run dev:worker  # worker, en otra terminal
```

### Parear WhatsApp con WAHA (dev, número de prueba)

1. `docker compose up -d` levanta WAHA en `http://localhost:3001`.
2. Abrir `http://localhost:3001/dashboard` (login `WAHA_DASHBOARD_USERNAME`/`PASSWORD`, por default `admin`/`changeme` -- si no se setean, WAHA genera una password random y hay que buscarla en `docker compose logs waha`). Adentro, cargar la API Key (`WAHA_API_KEY`, por default `changeme`) donde pida.
3. Crear/arrancar la sesión `default` (el dashboard lo hace solo, o `POST /api/sessions` con `{"name":"default","start":true}`), esperar a que pase a estado `SCAN_QR_CODE` y escanear el código con el número de prueba (WhatsApp del teléfono → Dispositivos vinculados). El QR vence rápido y se regenera solo unas pocas veces antes de que la sesión se pare -- si se pasa, hay que arrancarla de nuevo. No usar un número personal/de producción -- WAHA es un cliente no oficial, ver `docs/spec.md` sección 4.3.
4. Con la sesión en `WORKING`, mandarle un mensaje de texto al número desde otro teléfono: el webhook (`POST /webhooks/whatsapp`, configurado vía `WHATSAPP_HOOK_URL` en `docker-compose.yml`) lo recibe y lo encola en Redis (`whatsapp:incoming-messages`).
5. `WAHA_API_KEY` en `.env` tiene que ser el mismo valor que `WAHA_API_KEY` del container `waha`.

**Gotchas encontrados armando esto (Fase 2, tarea 29):**
- **`host.docker.internal` no siempre llega al host.** En Docker Desktop "nativo" (Mac/Windows) anda; en algunas instalaciones con backend WSL2 el container no logra conectar al proceso que corre en la distro (`ECONNREFUSED`). Si el webhook nunca llega, setear `WAHA_HOOK_HOST=<ip de \`hostname -I\` en la distro>` en `.env` -- ver `docker-compose.yml`.
- **La imagen de WAHA se queda vieja.** Con una imagen desactualizada, la sesión queda pegada re-autenticando sin nunca pasar a `WORKING` (el motor NOWEB tira `Error: Connection Failure` decodificando frames del protocolo). Si pasa eso, `docker compose pull waha` antes de sospechar de la red.
- **El remitente no siempre es el teléfono real.** Cuando el que escribe tiene la privacidad de número activada (común en cuentas Business), WAHA manda el remitente como `<id>@lid` en vez de `<telefono>@c.us` -- por eso `IncomingMessage.from` guarda el chatId completo tal cual, no el teléfono pelado (ver el comentario en `src/providers/types.ts`).
- **El system prompt del agente (tarea 33) necesita el límite de scope explícito, no alcanza con listar las 4 tools.** En la prueba real, escribir "capitulo" (typo de "catalogo") hizo que el agente contestara sobre series/películas usando conocimiento general en vez de redirigir. Agregar la lista de tools no evita que conteste algo fuera de ellas -- hay que decirle explícitamente que no es un asistente de propósito general y que ante un mensaje ambiguo pregunte en vez de adivinar (ver `SYSTEM_PROMPT` en `src/agent.ts`).

## Lint, tests, build

```bash
npm run lint
npm test
npm run build && npm start
```
