import { expect, test } from "@playwright/test"
import type { Content } from "../../shared/content"
import { whatsappUrl } from "../../shared/engagement"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("harshaweb-consent", "essential")
  )
})

test("contact channels use saved settings and enquiry context follows navigation", async ({
  page,
  request,
}) => {
  const content = (await (await request.get("/api/content")).json()) as Content
  await page.goto("/contact")
  const channels = page.locator("main .contact-channels")
  if (content.settings.contactPhone)
    await expect(
      channels.getByRole("link", { name: /Call us/ })
    ).toHaveAttribute(
      "href",
      `tel:${content.settings.contactPhone.replace(/[^+\d]/g, "")}`
    )
  if (content.settings.whatsappPhone)
    await expect(
      channels.getByRole("link", { name: /Chat on WhatsApp/ })
    ).toHaveAttribute("href", whatsappUrl(content.settings.whatsappPhone))
  await expect(page.locator('input[name="kind"]')).toHaveValue("contact")
  await page.locator(".header-cta").click()
  await expect(page).toHaveURL("/request-a-quote")
  await expect(page.locator('input[name="kind"]')).toHaveValue("quote")
  const service = content.services[0].title
  for (const kind of ["website", "application", "marketing"]) {
    await page.evaluate(
      (path) => {
        history.pushState({}, "", path)
        dispatchEvent(new PopStateEvent("popstate"))
      },
      `/enquiry/${kind}?service=${encodeURIComponent(service)}`
    )
    await expect(page.locator('input[name="kind"]')).toHaveValue(kind)
    await expect(page.locator("#lead-service")).toHaveValue(service)
  }
})

test("homepage and services stay usable at narrow phone, tablet and desktop widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ["/", "/services"]) {
      await page.goto(path)
      await expect(page.locator("main h1")).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        ),
        `${path} at ${width}px`
      ).toBe(true)
      if (path === "/") {
        const action = page.getByRole("link", {
          name: "Explore our services",
          exact: true,
        })
        const bounds = await action.boundingBox()
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        await expect(
          page.getByRole("link", { name: /PostgreSQL/ })
        ).toBeVisible()
      } else {
        const hero = await page.locator(".services-intro").boundingBox()
        const visual = await page
          .locator(".services-intro-visual")
          .boundingBox()
        expect(visual!.y + visual!.height).toBeLessThanOrEqual(
          hero!.y + hero!.height
        )
        await page
          .getByRole("link", { name: "Explore services", exact: true })
          .click()
        await expect(page).toHaveURL(/#explore-services$/)
        await expect(
          page.locator(".service-catalog .service-card").first()
        ).toBeVisible()
      }
    }
  }
})

test("every service filter matches saved categories and cards open the correct detail", async ({
  page,
  request,
}) => {
  const content = (await (await request.get("/api/content")).json()) as Content
  await page.goto("/services")
  const catalog = page.locator(".service-catalog")
  for (const category of [
    "All services",
    ...new Set(content.services.map((s) => s.category)),
  ]) {
    const expected = content.services.filter(
      (s) => category === "All services" || s.category === category
    )
    await catalog
      .getByRole("button", { name: new RegExp(`^${category}\\s*\\d+$`) })
      .click()
    await expect(catalog.locator(".service-card")).toHaveCount(expected.length)
    await expect(catalog.locator(".catalog-results")).toContainText(
      `${expected.length} ${expected.length === 1 ? "service" : "services"} to explore`
    )
    expect(
      await catalog
        .locator(".service-card")
        .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")))
    ).toEqual(expected.map((s) => `/services/${s.slug}`))
  }
  await catalog.getByRole("button", { name: /^All services/ }).click()
  await catalog.locator(".service-card").first().focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(`/services/${content.services[0].slug}`)
  await expect(page.locator("main h1")).toBeVisible()
})
