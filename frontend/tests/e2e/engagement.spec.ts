import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { mkdir } from "node:fs/promises"
const db = new PrismaClient()
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("harshaweb-consent", "essential")
  )
})
test.afterAll(async () => {
  await db.lead.deleteMany({ where: { email: { startsWith: "e2e+consult-" } } })
  await db.$disconnect()
})
test("original video plays, exposes a transcript and fits mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/videos")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A little clarity. In motion."
  )
  await page.getByRole("button", { name: "Play From idea to launch" }).click()
  const video = page.locator("video")
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.duration))
    .toBe(24)
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime)
    )
    .toBeGreaterThan(0.1)
  await expect(video).toHaveAttribute("controls", "")
  await page.getByText("Read video transcript", { exact: true }).click()
  await expect(
    page.getByText(/A clearer path from idea to launch/)
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await mkdir(".data/screenshots", { recursive: true })
  await page.screenshot({
    path: ".data/screenshots/videos-mobile.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto("/videos")
  await page.getByRole("button", { name: "Play From idea to launch" }).click()
  await expect(page.locator("video")).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.currentTime)
    )
    .toBeGreaterThan(1)
  await page.screenshot({ path: ".data/screenshots/videos-desktop.png" })
})
test("contact widget, configured channels and click-to-load external videos work", async ({
  page,
}) => {
  const frames: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("youtube-nocookie.com"))
      frames.push(request.url())
  })
  await page.route("**/api/content", async (route) => {
    const response = await route.fetch()
    const content = await response.json()
    Object.assign(content.settings, {
      contactPhone: "+91 98765 43210",
      whatsappPhone: "+91 98765 43210",
      contactEmail: "contact@example.com",
      address: "Test office address",
      businessHours: "Monday–Friday, 10 AM–6 PM",
      bookingUrl: "https://example.com/calendar",
      linkedinUrl: "https://www.linkedin.com/company/example",
      video2Title: "External test video",
      video2Url: "https://youtu.be/abcdefghijk",
    })
    await route.fulfill({ json: content })
  })
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Test player loaded</p>",
    })
  )
  await page.goto("/contact")
  await expect(
    page.locator(".contact-channels").getByRole("link", { name: /Call us/ })
  ).toHaveAttribute("href", "tel:+919876543210")
  await expect(
    page
      .locator(".contact-channels")
      .getByRole("link", { name: /Chat on WhatsApp/ })
  ).toHaveAttribute("href", /^https:\/\/wa.me\/919876543210/)
  await expect(
    page.getByRole("link", { name: "Get directions" })
  ).toHaveAttribute("href", /maps\/search/)
  await expect(
    page.getByRole("link", { name: /Choose an available time/ })
  ).toHaveAttribute("href", "https://example.com/calendar")
  await page.getByRole("button", { name: "Let’s talk", exact: true }).click()
  await expect(page.locator("#quick-contact-panel")).toBeVisible()
  await page.getByRole("button", { name: "Close contact" }).press("Escape")
  await expect(page.locator("#quick-contact-panel")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Let’s talk", exact: true })
  ).toBeFocused()
  await page.goto("/videos")
  await expect(
    page.getByRole("button", { name: "Play External test video" })
  ).toBeVisible()
  expect(frames).toHaveLength(0)
  await page.getByRole("button", { name: "Play External test video" }).click()
  await expect(
    page.locator("iframe[title='External test video']")
  ).toHaveAttribute("src", /youtube-nocookie\.com/)
  await expect.poll(() => frames.length).toBeGreaterThan(0)
})
test("consultation request persists a reference and never pretends a meeting is confirmed", async ({
  page,
}) => {
  const email = `e2e+consult-${Date.now()}@example.com`
  await page.goto("/book-a-consultation")
  await page.getByLabel("Full name").fill("Consultation test")
  await page.getByLabel("Business email").fill(email)
  await page.getByLabel("Phone with country code").fill("+91 98765 43210")
  await page.getByLabel("Company name").fill("Test business")
  await page
    .getByLabel("What would you like to discuss?")
    .fill("We want to discuss a new accessible website and integrations.")
  await page
    .getByRole("checkbox", { name: /^I agree to the Privacy Policy/ })
    .check()
  await page.getByLabel("Preferred date and time").fill("2000-01-01T10:00")
  await page.getByRole("button", { name: "Request a consultation" }).click()
  await expect(page.getByRole("alert")).toHaveText(
    "Choose a future preferred time or leave it blank."
  )
  await page.getByLabel("Preferred date and time").fill("2035-01-01T10:00")
  await page.getByRole("button", { name: "Request a consultation" }).click()
  await expect(
    page.getByRole("heading", { name: "Your consultation request is saved." })
  ).toBeVisible()
  await expect(page.getByText(/has not been confirmed/)).toBeVisible()
  const lead = await db.lead.findFirst({ where: { email } })
  expect(lead?.message).toContain("Consultation request")
  expect(lead?.message).toContain("2035-01-01")
  expect(lead?.reference).toMatch(/^HW-/)
})
