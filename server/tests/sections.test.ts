import { describe, it, expect } from "vitest"
import { sectionsSchema } from "../shared/sections"
import { initialContent } from "../shared/content"
import { renderPage } from "../src/render"

describe("Website section controls", () => {
  it("accepts sparse known sections and restricts content replacement", () => {
    expect(
      sectionsSchema.safeParse({ footer: { title: "Start a project" } }).success
    ).toBe(true)
    expect(
      sectionsSchema.safeParse({ unknown: { title: "Unknown" } }).success
    ).toBe(false)
    expect(sectionsSchema.safeParse({ header: { hidden: true } }).success).toBe(
      false
    )
    expect(
      sectionsSchema.safeParse({ "page:Contact:1": { body: "Remove form" } })
        .success
    ).toBe(false)
    expect(
      sectionsSchema.safeParse({ "page:About:1": { body: "## Our business" } })
        .success
    ).toBe(true)
  })
  it("renders the rental homepage independently of retained business section overrides", async () => {
    const content = structuredClone(initialContent)
    content.settings.sectionContent = JSON.stringify({
      "home:Home:3": {
        title: "Services tailored to you",
        description: "An editable introduction.",
      },
      "home:Home:4": { hidden: true },
      footer: { title: "Build your next idea" },
      "hero:/contact": { title: "Contact our team" },
    })
    const home = await renderPage("/", content)
    expect(home).toContain("Your next chapter starts here.")
    expect(home).toContain("rental-app")
    expect(home).not.toContain("Services tailored to you")
    const contact = await renderPage("/contact", content)
    expect(contact).toContain("get you sorted.")
    expect(contact).toContain("Checking your account")
  })
  it("renders safe replacement Markdown and restores the original when cleared", async () => {
    const content = structuredClone(initialContent)
    content.settings.sectionContent = JSON.stringify({
      "page:About:1": {
        body: "## Edited company content\n\n<script>alert(1)</script>",
      },
    })
    const html = await renderPage("/about", content)
    expect(html).toContain("Edited company content")
    expect(html).not.toContain("<script>alert(1)</script>")
    content.settings.sectionContent = "{}"
    expect(await renderPage("/about", content)).not.toContain(
      "Edited company content"
    )
  })
})
