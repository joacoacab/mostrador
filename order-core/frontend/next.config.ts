import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export estático (tarea 22, deploy): todas las páginas son client
  // components que hacen fetch a la API por su cuenta -- no hay nada
  // server-side (route handlers, server actions, cookies) que
  // necesite un runtime de Node en producción. Se sirve como archivos
  // estáticos + nginx, igual que el frontend de La Balanza.
  output: "export",
};

export default nextConfig;
