import { defineConfig, devices } from "@playwright/test"
import "dotenv/config"
export default defineConfig({
  testDir: "./frontend/tests/e2e",
  outputDir: "./test-results/rentals",
  testMatch: ["rentals.spec.ts", "payment-checkout.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // Vite binds to 127.0.0.1 in dev.ts; using localhost can resolve to ::1
    // on Windows and fail before the browser reaches the test server.
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
})
