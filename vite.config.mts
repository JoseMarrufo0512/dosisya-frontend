import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server", preset: "vercel" }
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),

  ],
  server: {
    port: 5173,
    host: true,
    // Proxy: en desarrollo local, las llamadas a /api/v1/* se reenvían
    // al backend FastAPI (localhost:8000) para evitar errores de CORS.
    // En producción (Vercel), VITE_API_URL apunta directamente al backend.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

