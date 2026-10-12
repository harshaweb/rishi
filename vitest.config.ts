import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    include: ["server/tests/**/*.test.ts"],
    setupFiles: ["server/tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: "forks",
    maxWorkers: 1,
  },
})
