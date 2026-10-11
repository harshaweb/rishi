import { defineConfig, devices } from "@playwright/test"
import "dotenv/config"
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/rentals",
  testMatch: "rentals.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
})
