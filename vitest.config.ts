import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config de test separada de vite.config.ts: el plugin tanstackStart (SSR)
// no aplica en unit tests y complica la resolución de módulos en Vitest.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
