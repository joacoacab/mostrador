# order-core/frontend

Frontend del Order Core: Next.js (App Router) + TypeScript + Tailwind, PWA.
Rutas principales: `/panel` (gestión, requiere login), `/pantalla` (solo lectura, tablet/TV del local) -- todavía no existen, llegan en las tareas 16 y 21.

PWA: manifest nativo de Next.js (`src/app/manifest.ts`) + service worker mínimo (`public/sw.js`, sin estrategia de cache todavía -- eso se agrega cuando la pantalla tablet/TV tenga datos reales que cachear). No usa `next-pwa`: no es compatible/recomendado para esta versión de Next.js, que ya trae soporte nativo de manifest.

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
