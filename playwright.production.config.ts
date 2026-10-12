import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "./frontend/tests/production",
  outputDir: "./test-results/production",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    // Simulate the HTTPS-terminating reverse proxy in the isolated fixture.
    extraHTTPHeaders: { "X-Forwarded-Proto": "https" },
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: {
    command: "node --import tsx server/scripts/test-production.ts",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
})
