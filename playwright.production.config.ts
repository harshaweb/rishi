import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/production",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  reporter: "list",
})
