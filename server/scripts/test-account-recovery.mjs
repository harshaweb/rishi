import assert from "node:assert/strict"
import { chromium } from "playwright"

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    baseURL: process.env.TEST_BASE_URL || "http://localhost:5173",
  })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  let unavailable = true
  await page.route("**/api/rental/session", (route) =>
    route.fulfill({
      status: unavailable ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        unavailable
          ? { error: "Account services are temporarily unavailable." }
          : {
              user: null,
              csrf: "recovery-test",
              paymentsConfigured: false,
              mapsToken: "",
              emailConfigured: false,
            }
      ),
    })
  )
  await page.goto("/trips", { waitUntil: "domcontentloaded" })
  await page.getByRole("heading", { name: "Let’s reconnect your account." }).waitFor()
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor()
  assert.equal(await page.getByText("Checking your account…", { exact: true }).count(), 0)
  unavailable = false
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await page.getByRole("heading", { name: "A place for your plans." }).waitFor()
  assert.equal(await page.getByRole("alert").count(), 0)
  assert.deepEqual(errors, [])
  console.log("PASS failed account bootstrap, repeated outage, and successful retry")
} finally {
  await browser.close()
}
