import "dotenv/config"
import express from "express"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { app, apiError } from "./app.js"
import { getPublicContent } from "./content.js"
import { allPublicRoutes } from "../shared/seo.js"
import type { Content } from "../shared/content.js"
const base = (process.env.SITE_URL || "http://localhost:5173").replace(
  /\/$/,
  ""
)
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
app.get("/robots.txt", (_req, res) => {
  res
    .type("text/plain")
    .send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nDisallow: /unsubscribe\nSitemap: ${base}/sitemap.xml\n`
    )
})
app.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const content = await getPublicContent()
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${allPublicRoutes(
        content as unknown as Content
      )
        .map((path) => `<url><loc>${escape(base + path)}</loc></url>`)
        .join("")}</urlset>`
    )
  } catch (error) {
    next(error)
  }
})
if (process.env.NODE_ENV === "production") {
  const template = await readFile(resolve("dist/index.html"), "utf8")
  const { renderDocument } = await import("./document.js")
  // On Vercel, dist assets are served by the CDN before the function fallback.
  if (!process.env.VERCEL)
    app.use(express.static(resolve("dist"), { index: false, maxAge: "1h" }))
  app.get("/{*path}", async (req, res, next) => {
    try {
      const content = (await getPublicContent()) as unknown as Content
      const { html, metadata } = await renderDocument(
        template,
        req.originalUrl,
        content,
        base
      )
      if (metadata.noindex) res.setHeader("X-Robots-Tag", "noindex, nofollow")
      res.setHeader("Cache-Control", "no-store")
      res
        .status(metadata.exists ? 200 : 404)
        .type("html")
        .send(html)
    } catch (error) {
      next(error)
    }
  })
}
app.use(apiError)
export { app }
export { disconnect } from "./db.js"
