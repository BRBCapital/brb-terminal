import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // "server-only" is a Next.js build-time guard with no runtime; stub it
      // so server modules (e.g. crypto) can be unit-tested directly.
      "server-only": resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
