import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The AI tests run against local mock servers that read env vars per
    // call, so files must not share a process.
    pool: "forks",
    testTimeout: 20_000,
  },
});
