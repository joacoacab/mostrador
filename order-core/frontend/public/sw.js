// Service worker mínimo: registra la PWA como instalable. Sin
// estrategia de cache todavía -- eso se agrega en las tareas 19-21
// (pantalla tablet/TV), cuando haya datos reales de pedidos que
// cachear para sobrevivir un corte breve de wifi.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
