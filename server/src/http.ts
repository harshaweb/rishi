import "dotenv/config"
import express, { type ErrorRequestHandler } from "express"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { app, apiError } from "./app.js"
import { getPublicContent } from "./content.js"
import { allPublicRoutes } from "../shared/seo.js"
import type { Content } from "../shared/content.js"
import { isMongo } from "./database-url.js"
import { properties } from "./mongo-rental-store.js"
import { rq } from "./rental-core.js"
import { rentalRegionSql } from "./rental-region.js"
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
    const slugs = isMongo ? await properties({demo:false}, undefined, true, 100000) : await rq(
      `SELECT p.slug FROM "RentalProperty" p JOIN "RentalUser" u ON u.id=p."hostId" WHERE p.status='PUBLISHED' AND NOT p.demo AND u.active AND ${rentalRegionSql()}`
    )
    content.rentals.push(
      ...slugs
        .filter((p) => !content.rentals.some((r) => r.slug === p.slug))
        .map(
          (p) => ({ slug: p.slug, demo: false }) as Content["rentals"][number]
        )
    )
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
    app.use(
      express.static(resolve("dist"), {
        index: false,
        redirect: false,
        maxAge: "1h",
      })
    )
  app.get("/{*path}", async (req, res, next) => {
    try {
      const rentalSlug = req.path.match(/^\/stays\/([^/]+)\/?$/)?.[1]
      const content = (await getPublicContent(rentalSlug)) as unknown as Content
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
// Page failures must remain HTML; API clients keep their structured errors.
const pageError: ErrorRequestHandler = (error, req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/") || res.headersSent)
    return next(error)
  console.error("Page render failed", req.requestId, {
    name: error instanceof Error ? error.name : "UnknownError",
    code: typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code : undefined,
  })
  res.status(503).set({
    "Cache-Control": "no-store",
    "Retry-After": "60",
    "X-Robots-Tag": "noindex, nofollow",
  }).type("html").send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Omshivraj — Service temporarily unavailable</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f5;color:#242424;font:16px/1.6 system-ui,sans-serif}main{max-width:520px;padding:32px}h1{font-size:clamp(28px,6vw,40px);line-height:1.15}a{display:inline-block;background:#e74961;color:white;border-radius:12px;padding:12px 24px;text-decoration:none;font-weight:600}small{display:block;margin-top:24px;color:#666;overflow-wrap:anywhere}</style>
</head><body><main><strong>Omshivraj</strong><h1>We’re having trouble connecting.</h1>
<p>Our booking service is temporarily unavailable. Please try again shortly.</p>
<a href="/">Try again</a><small>Reference: ${escape(req.requestId || "unavailable")}</small>
</main></body></html>`)
}
app.use(pageError)
app.use(apiError)
export { app }
export { disconnect } from "./db.js"
