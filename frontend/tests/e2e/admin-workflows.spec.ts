import { test, expect } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("harshaweb-consent", "essential")
  )
  const access = await readFile(".data/local-admin.txt", "utf8")
  await page.goto("/admin")
  await page
    .getByLabel("Email address")
    .fill(access.match(/Email: (.+)/)![1].trim())
  await page
    .getByLabel("Password", { exact: true })
    .fill(access.match(/Password: (.+)/)![1].trim())
  await page.getByRole("button", { name: "Sign in securely" }).click()
  await expect(
    page.getByRole("heading", { name: "A clear view of what’s next." })
  ).toBeVisible()
})
test.afterAll(async () => {
  await db.blogPost.deleteMany({ where: { slug: { startsWith: "e2e-" } } })
  await db.lead.deleteMany({ where: { email: { startsWith: "e2e+" } } })
  await db.$disconnect()
})

test("website section editor publishes headings, hides sections and restores original content", async ({
  page,
}) => {
  const row = await db.siteSetting.findUnique({
    where: { key: "sectionContent" },
  })
  const previous = JSON.parse(row?.value || "{}")
  const id = "home:Home:3"
  try {
    await page
      .getByRole("link", { name: "Website sections", exact: true })
      .click()
    await page.getByLabel("Website section", { exact: true }).selectOption(id)
    await page
      .getByLabel("Heading or button label")
      .fill("Digital solutions built around your business.")
    await page
      .getByLabel("Introductory text")
      .fill("A saved introduction from the website section editor.")
    await page
      .getByRole("button", { name: "Save section", exact: true })
      .click()
    await expect(page.getByRole("status")).toContainText("Section saved")
    const website = await page.context().newPage()
    await website.goto("/")
    await expect(website.locator("#expertise h2")).toHaveText(
      "Digital solutions built around your business."
    )
    await expect(website.locator("#expertise")).toContainText(
      "A saved introduction from the website section editor."
    )
    await page.getByLabel("Hide this section on the website").check()
    await page
      .getByRole("button", { name: "Save section", exact: true })
      .click()
    await expect(page.getByRole("status")).toContainText("Section saved")
    await website.reload()
    await expect(website.locator("#expertise")).toHaveCount(0)
    await page.getByRole("button", { name: "Restore original content" }).click()
    await page
      .getByRole("button", { name: "Save section", exact: true })
      .click()
    await expect(page.getByRole("status")).toContainText("Section saved")
    await website.reload()
    await expect(website.locator("#expertise h2")).toHaveText(
      "Your ambition. Our expertise."
    )
    await page.screenshot({
      path: ".data/screenshots/admin-sections.png",
      fullPage: true,
    })
    await website.close()
  } finally {
    const current = await db.siteSetting.findUnique({
      where: { key: "sectionContent" },
    })
    const next = JSON.parse(current?.value || "{}")
    if (previous[id]) next[id] = previous[id]
    else delete next[id]
    await db.siteSetting.upsert({
      where: { key: "sectionContent" },
      create: { key: "sectionContent", value: JSON.stringify(next) },
      update: { value: JSON.stringify(next) },
    })
  }
})
test("staff can create, preview, publish, edit and delete an article", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Articles", exact: true }).click()
  await page.getByRole("button", { name: "Add new" }).click()
  await page
    .getByLabel("Title", { exact: false })
    .first()
    .fill("E2E article workflow")
  await page.getByLabel("URL slug").fill("e2e-article-workflow")
  await page
    .getByLabel("Short description")
    .fill("An article created by a real browser test.")
  await page
    .getByLabel("Content (Markdown)")
    .fill("## A purposeful heading\nThis is safe Markdown with **emphasis**.")
  await page.getByRole("button", { name: "Preview formatted content" }).click()
  await expect(
    page.getByRole("heading", { name: "A purposeful heading" })
  ).toBeVisible()
  await page.getByLabel("Publication status").selectOption("PUBLISHED")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(
    page.getByText("E2E article workflow", { exact: true })
  ).toBeVisible()
  await page.goto("/resources/e2e-article-workflow")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "E2E article workflow"
  )
  await expect(
    page.getByRole("heading", { name: "A purposeful heading" })
  ).toBeVisible()
  await page.goto("/admin/posts")
  await page.getByRole("button", { name: "Edit E2E article workflow" }).click()
  await page
    .getByLabel("Title", { exact: false })
    .first()
    .fill("E2E updated article")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(
    page.getByText("E2E updated article", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete E2E updated article" }).click()
  await page.getByRole("button", { name: "Delete permanently" }).click()
  await expect(
    page.getByText("E2E updated article", { exact: true })
  ).toHaveCount(0)
})
test("lead follow-up, notes and deletion work through the dashboard", async ({
  page,
  request,
}) => {
  const email = `e2e+workflow-${Date.now()}@example.com`
  const result = await request.post("/api/leads", {
    headers: { Origin: "http://localhost:5173" },
    data: {
      submissionId: crypto.randomUUID(),
      name: "E2E workflow visitor",
      email,
      phone: "+91 98765 43210",
      company: "E2E workflow business",
      service: "Not sure yet",
      budget: "Let’s discuss",
      timeline: "Exploring options",
      message:
        "We need a thoughtful application with a clear operational workflow.",
      consent: true,
    },
  })
  expect(result.status()).toBe(201)
  await page.getByRole("link", { name: "Enquiries", exact: true }).click()
  await page
    .getByRole("button", { name: "Open enquiry from E2E workflow visitor" })
    .click()
  await page.getByLabel("Enquiry status").selectOption("CONTACTED")
  await page.getByLabel("Follow-up date").fill("2026-11-01")
  await page.getByRole("button", { name: "Save follow-up" }).click()
  await expect(page.getByText("Follow-up details saved.")).toBeVisible()
  await page
    .getByLabel("Add an internal note")
    .fill("Discovery call ready to plan.")
  await page.getByRole("button", { name: "Add note", exact: true }).click()
  await expect(
    page.getByText("Discovery call ready to plan.", { exact: true })
  ).toBeVisible()
  const lead = await db.lead.findFirstOrThrow({ where: { email } })
  expect(lead.status).toBe("CONTACTED")
  expect(lead.followUpAt?.toISOString()).toContain("2026-11-01")
  await page
    .getByRole("button", { name: "Delete enquiry", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirm permanent deletion" }).click()
  await expect(
    page.getByRole("button", { name: "Open enquiry from E2E workflow visitor" })
  ).toHaveCount(0)
})
