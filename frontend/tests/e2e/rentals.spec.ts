import { test, expect, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
const date = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
async function login(page: Page, role = "Guest") {
  const credentials = await readFile(".data/rental-demo.txt", "utf8")
  const email = credentials.match(new RegExp(`${role} email: (.+)`))![1],
    password = credentials.match(new RegExp(`${role} password: (.+)`))![1]
  await page.goto("/login")
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Log in", exact: true }).click()
  await expect(page).toHaveURL(/trips/)
}
test("destination search, guest selection, filtering and photo carousel", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/Omshivraj/)
  await expect(page.locator(".r-card").first()).toBeVisible()
  await page
    .getByLabel("Choose your destination")
    .selectOption({ label: "Delhi" })
  await page.getByLabel("Home search check-in").fill(date(8))
  await page.getByLabel("Home search checkout").fill(date(10))
  await page.locator(".r-bloom-search-guests").click()
  await page.getByRole("dialog").getByLabel("Add adults").click()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await page.getByRole("button", { name: "Search stays" }).click()
  await expect(page).toHaveURL(/destination=Delhi/)
  await expect(
    page.getByRole("heading", { name: "Stays in Delhi", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Filters", exact: true }).click()
  await page.getByRole("dialog").getByLabel(/Wi-Fi/).check()
  await page.getByRole("button", { name: /Show matching stays/ }).click()
  await expect(page).toHaveURL(/amenities=Wi-Fi/)
  const card = page.locator(".r-card").first(),
    src = await card.locator("img").getAttribute("src")
  await card.hover()
  await card.getByRole("button", { name: /Next photo/ }).click()
  await expect(card.locator("img")).not.toHaveAttribute("src", src!)
  await card.locator(".r-card-description").click()
  await expect(page.locator(".r-property-gallery")).toBeVisible()
  await page.getByRole("button", { name: /Show all photos/ }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
test("account wishlist, private messages, quote and cancellable booking request", async ({
  page,
}) => {
  await login(page)
  await page.goto("/search?destination=Delhi")
  const card = page.locator(".r-card").first()
  await card.getByRole("button", { name: /Save |Remove / }).click()
  await card.locator(".r-card-description").click()
  await page.getByLabel("Booking check-in").fill(date(110))
  await page.getByLabel("Booking checkout").fill(date(112))
  await page
    .getByRole("button", { name: "Check availability", exact: true })
    .click()
  await expect(page.locator(".r-price-total")).toBeVisible()
  await page
    .getByRole("button", { name: "Request to book", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm booking request", exact: true })
    .click()
  await expect(page).toHaveURL(/trips/)
  const trips = page
    .locator(".r-trip")
    .filter({ has: page.getByText("PENDING", { exact: true }) })
  await expect(trips.first()).toBeVisible()
  await trips
    .first()
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click()
  await page
    .getByLabel("Reason for cancellation")
    .fill("Automated development QA cancellation")
  await page.getByRole("button", { name: "Confirm cancellation" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.goto("/wishlists")
  await expect(
    page.getByRole("button", { name: "Create wishlist", exact: true })
  ).toBeVisible()
  await page.goto("/profile")
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Demo traveller"
  )
  await page.goto("/search?destination=Gurugram")
  await page.locator(".r-card-description").first().click()
  await page.getByRole("button", { name: "Contact the host" }).click()
  await page
    .getByLabel("Your message")
    .fill("Development browser QA: is parking available?")
  await page.getByRole("button", { name: "Send message", exact: true }).click()
  await expect(page).toHaveURL("/messages")
  await page.locator(".r-inbox aside button").first().click()
  await expect(page.locator(".r-message-history")).toContainText(
    "Development browser QA"
  )
})
test("host workspace and private draft editor", async ({ page }) => {
  await login(page, "Host")
  await page.goto("/host/listings")
  await expect(page.getByRole("link", { name: "+ Add a stay" })).toBeVisible()
  await page.getByRole("link", { name: "Edit listing" }).first().click()
  await expect(page.getByLabel("Listing title")).not.toBeEmpty()
  await expect(page.getByLabel("Check-in time")).toHaveValue("15:00")
  await page.goto("/host/calendar")
  await expect(
    page.getByRole("button", { name: "Block dates", exact: true })
  ).toBeVisible()
  await page.goto("/host/reservations")
  await expect(
    page.getByRole("heading", { name: /hosting/, level: 1 })
  ).toBeVisible()
  await page.goto("/host/earnings")
  await expect(
    page.getByText("Due at property · not collected online")
  ).toBeVisible()
  await page.goto("/host/reviews")
  await expect(page.getByText("Reviews appear here")).toBeVisible()
})
test("administrator routes load their requested sections and records", async ({
  page,
}) => {
  const credentials = await readFile(".data/local-admin.txt", "utf8")
  await page.goto("/login")
  await page
    .getByLabel("Email address")
    .fill(credentials.match(/Email: (.+)/)![1])
  await page
    .getByLabel("Password", { exact: true })
    .fill(credentials.match(/Password: (.+)/)![1])
  await page.getByRole("button", { name: "Log in", exact: true }).click()
  await expect(page).toHaveURL(/trips/)
  for (const [entity, title] of Object.entries({
    users: "Guests & users",
    hosts: "Hosts",
    listings: "Properties",
    bookings: "Reservations",
    payments: "Payments",
    refunds: "Refunds",
    reviews: "Reviews",
    reports: "Support reports",
    categories: "Categories",
    coupons: "Coupons",
    settings: "Settings",
    audit: "Activity log",
  })) {
    await page.goto(`/admin/${entity}`)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title)
    if (entity === "settings")
      await expect(page.getByLabel("Site announcement")).toBeVisible()
    else {
      const searchLabel =
        entity === "bookings" ? "Search reservations" : `Search ${entity}`
      await expect(
        page.getByLabel(searchLabel, { exact: true })
      ).toBeVisible()
      if (entity === "bookings")
        await expect(page.getByLabel("Reservation status")).toBeVisible()
    }
    await expect(page.locator(".r-table-wrap")).toBeVisible()
  }
  await page.goto("/admin/users")
  await page.getByRole("button", { name: "Details / actions" }).first().click()
  await expect(page.getByRole("dialog")).toContainText("Manage users")
  await page.keyboard.press("Escape")
})
test("all public and account routes render without browser errors or horizontal overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  for (const path of [
    "/",
    "/search",
    "/login",
    "/signup",
    "/forgot-password",
    "/help",
    "/contact",
    "/terms",
    "/privacy",
    "/cancellation-policy",
    "/experiences",
    "/host",
    "/profile",
    "/wishlists",
    "/trips",
    "/messages",
    "/admin/users",
  ]) {
    await page.goto(path)
    await expect(page.locator("main")).toBeVisible()
    await expect(page.locator("body")).not.toContainText("Something went wrong")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      ),
      path
    ).toBe(true)
  }
  expect(errors).toEqual([])
})
