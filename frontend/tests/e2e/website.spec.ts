import { test, expect } from "@playwright/test"
import { readFile, mkdir } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { allPublicRoutes } from "../../../server/shared/seo"
import type { Content } from "../../../server/shared/content"
const db = new PrismaClient()
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes("consent preferences")) return
  await page.addInitScript(() =>
    localStorage.setItem("harshaweb-consent", "essential")
  )
})
test.afterAll(async () => {
  await db.lead.deleteMany({ where: { email: { startsWith: "e2e+" } } })
  await db.newsletterSubscriber.deleteMany({
    where: { email: { startsWith: "e2e+" } },
  })
  await db.jobApplication.deleteMany({
    where: { email: { startsWith: "e2e+" } },
  })
  await db.blogPost.deleteMany({ where: { slug: { startsWith: "e2e-" } } })
  await db.blogCategory.deleteMany({ where: { slug: { startsWith: "e2e-" } } })
  await db.$disconnect()
})
test("homepage, desktop dropdowns and original visual render without runtime errors", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Technology that"
  )
  await expect(
    page.getByRole("img", { name: /Original illustration/ })
  ).toBeVisible()
  await page.getByRole("button", { name: "Services", exact: true }).click()
  await expect(page.locator("#services-dropdown")).toBeVisible()
  await page
    .locator("#services-dropdown")
    .getByRole("link", { name: "UI/UX Design", exact: true })
    .click()
  await expect(page).toHaveURL(/services\/ui-ux-design/)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Clarity at every interaction"
  )
  await page.goto("/")
  await mkdir(".data/screenshots", { recursive: true })
  await page.locator("#project-enquiry").scrollIntoViewIfNeeded()
  await expect(page.locator("#lead-name")).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: ".data/screenshots/home-desktop.png",
    fullPage: true,
  })
  expect(errors).toEqual([])
})
test("mobile navigation, dropdowns and layout work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: "Open navigation" }).click()
  await expect(page.locator("#primary-navigation")).toBeVisible()
  await page.getByRole("button", { name: "Company", exact: true }).click()
  await page
    .locator("#company-dropdown")
    .getByRole("link", { name: "Our process" })
    .click()
  await expect(page).toHaveURL("/process")
  await expect(
    page.getByRole("button", { name: "Open navigation" })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.goto("/")
  await page.locator("#project-enquiry").scrollIntoViewIfNeeded()
  await expect(page.locator("#lead-name")).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: ".data/screenshots/home-mobile.png",
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})
test("header stays unique through repeated desktop and mobile navigation", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  await mkdir(".data/screenshots", { recursive: true })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    for (const label of ["Vision & Mission", "Videos", "About us"]) {
      if (width === 390)
        await page.getByRole("button", { name: "Open navigation" }).click()
      await page.getByRole("button", { name: "Company", exact: true }).click()
      await page
        .locator("#company-dropdown")
        .getByRole("link", { name: label, exact: true })
        .click()
      await expect(page.locator("main h1")).toBeVisible()
      await expect(page.locator(".site-header")).toHaveCount(1)
      await expect(page.locator(".announcement")).toHaveCount(1)
      await expect(
        page.getByRole("button", {
          name: "Company",
          exact: true,
          includeHidden: true,
        })
      ).toHaveClass(/active/)
      await expect(page.locator("#company-dropdown")).toHaveCount(0)
      await page
        .getByRole("banner")
        .getByRole("link", { name: "Harshaweb home", exact: true })
        .click()
      await expect(page.locator("main h1")).toContainText("Technology that")
      await expect(page.locator(".site-header")).toHaveCount(1)
    }
    if (width === 390)
      await page.getByRole("button", { name: "Open navigation" }).click()
    await page.getByRole("button", { name: "Services", exact: true }).click()
    await page
      .getByRole("button", { name: "Services", exact: true })
      .press("Escape")
    await expect(page.locator("#services-dropdown")).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: `.data/screenshots/header-${width === 390 ? "mobile" : "desktop"}.png`,
    })
  }
  expect(errors).toEqual([])
})

test("all public pages resolve and internal links point to real routes", async ({
  page,
  request,
}) => {
  const content = (await (await request.get("/api/content")).json()) as Content
  const routes = allPublicRoutes(content)
  const discovered = new Set<string>()
  for (const path of routes) {
    await page.goto(path)
    await expect(page.locator("main h1").first()).toBeVisible()
    await expect(page.locator("main h1").first()).not.toContainText(
      "This page took a different path"
    )
    const links = await page
      .locator("a[href]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")!))
    links
      .filter((link) => link.startsWith("/"))
      .forEach((link) => discovered.add(link.split(/[?#]/)[0]))
    expect(links).not.toContain("#")
  }
  for (const path of discovered)
    expect([...routes, "/admin", "/unsubscribe"]).toContain(path)
})
test("contact validates inputs, saves a real lead and reports email configuration accurately", async ({
  page,
}) => {
  await page.goto("/contact")
  await page.getByRole("button", { name: /Let’s start a conversation/ }).click()
  await expect(page.getByText("This field is required.").first()).toBeVisible()
  await page.getByLabel("Full name", { exact: false }).fill("E2E visitor")
  const email = `e2e+${Date.now()}@example.com`
  await page.getByLabel("Business email").fill(email)
  await page.getByLabel("Phone with country code").fill("+91 98765 43210")
  await page.getByLabel("Company name").fill("E2E business")
  await page.getByLabel("Estimated budget").selectOption("Let’s discuss")
  await page.getByLabel("Project timeline").selectOption("Exploring options")
  await page
    .getByLabel("A little about your project")
    .fill(
      "We need a thoughtful website with accessible navigation and a usable enquiry flow."
    )
  await page.locator('.lead-form input[type="checkbox"]').check()
  await page.getByRole("button", { name: /Let’s start a conversation/ }).click()
  await expect(
    page.getByRole("heading", { name: "Your idea is in good hands." })
  ).toBeVisible()
  await expect(
    page.getByText(/no confirmation email has been sent/)
  ).toBeVisible()
  const lead = await db.lead.findFirst({ where: { email } })
  expect(lead?.reference).toMatch(/^HW-/)
})
test("resource search, category filter, portfolio filter and FAQ accordion work", async ({
  page,
}) => {
  await page.goto("/resources")
  await page.getByLabel("Search articles").fill("accessible")
  await expect(page.locator(".article-card")).toHaveCount(1)
  await page.getByLabel("Search articles").fill("no-matching-article-xyz")
  await expect(
    page.getByRole("heading", { name: "No matching perspectives." })
  ).toBeVisible()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(page.locator(".article-card")).toHaveCount(3)
  await page.getByLabel("Article category").selectOption("category-1")
  await expect(page.locator(".article-card")).toHaveCount(1)
  await page.goto("/portfolio")
  await page.getByRole("button", { name: "E-commerce", exact: true }).click()
  await expect(page.locator(".project-card")).toHaveCount(1)
  await page.goto("/")
  await page
    .locator("summary")
    .filter({ hasText: "How do we get started?" })
    .click()
  await expect(
    page.getByText(
      /Tell us what you want to achieve using the project enquiry form/
    )
  ).toBeVisible()
})
test("newsletter consent and career application persist", async ({ page }) => {
  await page.goto("/resources")
  await page
    .locator(".newsletter-section")
    .getByRole("button", { name: "Subscribe to newsletter" })
    .click()
  await expect(
    page
      .locator(".newsletter-section")
      .getByText("Enter a valid email address.")
  ).toBeVisible()
  const email = `e2e+newsletter-${Date.now()}@example.com`
  await page
    .locator(".newsletter-section")
    .getByLabel("Email address", { exact: true })
    .fill(email)
  await page.locator('.newsletter-section input[type="checkbox"]').check()
  await page
    .locator(".newsletter-section")
    .getByRole("button", { name: "Subscribe to newsletter" })
    .click()
  await expect(
    page.locator(".newsletter-section").getByRole("status")
  ).toContainText("subscription is saved")
  expect(await db.newsletterSubscriber.count({ where: { email } })).toBe(1)
  await page.goto("/careers")
  await page.getByLabel("Full name").fill("E2E applicant")
  const applicant = `e2e+career-${Date.now()}@example.com`
  await page
    .locator("main")
    .getByLabel("Email address", { exact: false })
    .fill(applicant)
  await page
    .getByLabel("Tell us about your skills")
    .fill(
      "I build accessible applications with thoughtful design and dependable engineering."
    )
  await page.locator('main input[type="checkbox"]').check()
  await page.getByRole("button", { name: "Send your application" }).click()
  await expect(page.getByRole("status")).toContainText(
    "application has been saved"
  )
  expect(await db.jobApplication.count({ where: { email: applicant } })).toBe(1)
})
test("admin login, content CRUD, actual metrics and logout work", async ({
  page,
}) => {
  const credentials = await readFile(".data/local-admin.txt", "utf8")
  const email = credentials.match(/Email: (.+)/)![1].trim()
  const password = credentials.match(/Password: (.+)/)![1].trim()
  await page.goto("/admin")
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in securely" }).click()
  await expect(
    page.getByRole("heading", { name: "A clear view of what’s next." })
  ).toBeVisible()
  await page.getByRole("link", { name: "Categories", exact: true }).click()
  await page.getByRole("button", { name: "Add new" }).click()
  await page.getByLabel("Category name").fill("E2E browser category")
  await page.getByLabel("URL slug").fill("e2e-browser-category")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(
    page.getByText("E2E browser category", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Edit E2E browser category" }).click()
  await page.getByLabel("Category name").fill("E2E updated category")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(
    page.getByText("E2E updated category", { exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Delete E2E updated category" })
    .click()
  await page.getByRole("button", { name: "Delete permanently" }).click()
  await expect(
    page.getByText("E2E updated category", { exact: true })
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Sign in securely" })
  ).toBeVisible()
})
test("custom 404, keyboard access and consent preferences work", async ({
  page,
}) => {
  await page.goto("/does-not-exist")
  await expect(
    page.getByRole("heading", { name: "This page took a different path." })
  ).toBeVisible()
  await page.getByRole("link", { name: "Back to home" }).click()
  await expect(page).toHaveURL("/")
  await page.evaluate(() => localStorage.removeItem("harshaweb-consent"))
  await page.reload()
  await expect(
    page.getByRole("complementary", { name: "Cookie preferences" })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Essential only", exact: true })
    .click()
  expect(
    await page.evaluate(() => localStorage.getItem("harshaweb-consent"))
  ).toBe("essential")
  await page.keyboard.press("Tab")
  await expect(page.locator(":focus")).toHaveCount(1)
})
