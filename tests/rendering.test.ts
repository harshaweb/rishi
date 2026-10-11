import { describe, expect, it } from "vitest"
import { renderPage } from "../server/render"
import { allPublicRoutes, pageMetadata } from "../shared/seo"
import { initialContent } from "../shared/content"
import { renderDocument } from "../server/document"
import { readFile } from "node:fs/promises"
describe("Production rendering and metadata", () => {
  it("builds the real production HTML document with safe metadata and hydration data", async () => {
    const template = await readFile("index.html", "utf8")
    const content = structuredClone(initialContent)
    content.services[0].seoTitle = 'Quality $& "work" <script>'
    const { html, metadata } = await renderDocument(
      template,
      "/services/website-development",
      content,
      "https://www.harshaweb.com"
    )
    expect(html).toContain("<h1>")
    expect(html).toContain(
      "<title>Quality $&amp; &quot;work&quot; &lt;script&gt; | Harshaweb</title>"
    )
    expect(html).toContain(
      'href="https://www.harshaweb.com/services/website-development"'
    )
    expect(html).toContain("application/ld+json")
    expect(html).toContain('id="initial-content"')
    expect(metadata.exists).toBe(true)
    expect(html).not.toContain('Quality $& "work" <script>')
  })
  it("renders every public page on the server, including lazy-loaded routes", async () => {
    for (const path of allPublicRoutes(initialContent)) {
      const html = await renderPage(path, initialContent)
      expect(html, path).toContain("<h1>")
      expect(html, path).not.toContain("This page took a different path")
      expect(html, path).not.toContain("Loading your next perspective")
      expect(html, path).not.toContain('href="#"')
    }
  })
  it("provides unique public metadata and correct private indexing controls", () => {
    const titles = allPublicRoutes(initialContent).map(
      (path) => pageMetadata(path, initialContent).title
    )
    expect(new Set(titles).size).toBe(titles.length)
    expect(pageMetadata("/admin", initialContent).noindex).toBe(true)
    expect(pageMetadata("/missing", initialContent).exists).toBe(false)
    expect(pageMetadata("/missing", initialContent).noindex).toBe(true)
  })
  it("renders a custom missing page and safe Markdown without executable HTML", async () => {
    const missing = await renderPage("/missing", initialContent)
    expect(missing).toContain("This page took a different path")
    const content = structuredClone(initialContent)
    content.posts[0].body =
      '## Safe heading\n<script>alert("xss")</script>\n[Bad link](javascript:alert(1))'
    const html = await renderPage(
      `/resources/${content.posts[0].slug}`,
      content
    )
    expect(html).toContain("Safe heading")
    expect(html).not.toContain("<script>alert")
    expect(html).not.toContain('href="javascript:')
  })
})
