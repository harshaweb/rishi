import { test, expect } from "@playwright/test"
import { allPublicRoutes } from "../../../server/shared/seo"
import type { Content } from "../../../server/shared/content"

test("all public routes fit a narrow phone and load their images without runtime errors", async ({
  page,
  request,
}) => {
  test.setTimeout(120000)
  const content = (await (await request.get("/api/content")).json()) as Content
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addInitScript(() =>
    localStorage.setItem("harshaweb-consent", "essential")
  )
  for (const path of allPublicRoutes(content)) {
    await page.goto(path)
    await expect(page.locator("main h1").first(), path).toBeVisible()
    await page.evaluate(async () => {
      await document.fonts.ready
      document
        .querySelectorAll("img")
        .forEach((image) => (image.loading = "eager"))
    })
    await expect
      .poll(
        () =>
          page
            .locator("img")
            .evaluateAll((images) =>
              images.every((image) => image.complete && image.naturalWidth > 0)
            ),
        { message: `Images on ${path}` }
      )
      .toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      path
    ).toBe(true)
    await expect(page.locator(".system-notice"), path).toHaveCount(0)
  }
  expect(errors).toEqual([])
})
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

test("page routes sharing asset folder names work with and without trailing slashes", async ({
  request,
}) => {
  for (const path of ["/portfolio", "/videos", "/portfolio/", "/videos/"]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(200)
    expect(await response.text(), path).toContain(
      `href="https://www.harshaweb.com${path.replace(/\/$/, "")}"`
    )
  }
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
    "Your next chapter"
  )
  await page.getByRole("link", { name: "Find your getaway" }).click()
  await expect(page).toHaveURL("/search")
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A place for every kind of escape"
  )
  await page.goto("/help")
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little help"
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
