import { test, expect } from "@playwright/test"
import { allPublicRoutes } from "../../shared/seo"
import type { Content } from "../../shared/content"
test("production renders every public route on the server with unique SEO metadata", async ({
  request,
}) => {
  const content = (await (await request.get("/api/content")).json()) as Content
  const titles = new Set<string>()
  for (const path of allPublicRoutes(content)) {
    const result = await request.get(path)
    expect(result.status(), path).toBe(200)
    const html = await result.text()
    expect(html, path).toContain("<h1>")
    expect(html).toContain('id="initial-content"')
    expect(html).toContain("application/ld+json")
    expect(html).toContain(`href="https://www.harshaweb.com${path}"`)
    const title = html.match(/<title>(.*?)<\/title>/)![1]
    expect(titles.has(title), title).toBe(false)
    titles.add(title)
  }
})
test("sitemap, robots, 404 responses and private indexing controls are correct", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text()
  expect(sitemap).toContain("/services/website-development")
  expect(sitemap).toContain("/resources/")
  expect(sitemap).not.toContain("/admin")
  expect(sitemap).not.toContain("private-test-draft")
  const robots = await (await request.get("/robots.txt")).text()
  expect(robots).toContain("Disallow: /admin")
  const missing = await request.get("/missing-production-page")
  expect(missing.status()).toBe(404)
  expect(missing.headers()["x-robots-tag"]).toBe("noindex, nofollow")
  const admin = await request.get("/admin")
  expect(admin.headers()["x-robots-tag"]).toBe("noindex, nofollow")
  expect((await request.get("/api/admin/leads")).status()).toBe(401)
})
test("production hydration, lazy pages and security headers work in the browser", async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() =>
    localStorage.setItem("harshaweb-consent", "essential")
  )
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Technology"
  )
  await page
    .getByRole("link", { name: "Explore our services", exact: true })
    .click()
  await expect(page).toHaveURL("/services")
  await expect(page.locator(".service-card")).toHaveCount(15)
  await page
    .getByRole("link", { name: /Website Design & Development/ })
    .first()
    .click()
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A better first impression"
  )
  expect(errors).toEqual([])
  const response = await request.get("/api/auth/session")
  expect(response.headers()["set-cookie"]).toContain("HttpOnly")
  expect(response.headers()["set-cookie"]).toContain("Secure")
  expect(response.headers()["set-cookie"]).toContain("SameSite=Strict")
  const home = await request.get("/")
  expect(home.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  )
  expect(home.headers()["x-content-type-options"]).toBe("nosniff")
})
