import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Kept separate from vite.config.ts on purpose: the app config loads the
// tanstackStart plugin and a dev-only API middleware, neither of which a unit
// test needs. tsconfigPaths is here so specs can import via the "@/" alias.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["spec/**/*.test.ts", "spec/**/*.test.tsx"],
    environment: "node",
  },
});
