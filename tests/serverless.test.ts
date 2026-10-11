import { afterAll, beforeAll, expect, it } from "vitest"
import request from "supertest"
import { copyFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { Express } from "express"
// Preload the development JSX runtime used by Vitest's transform.
import "react/jsx-dev-runtime"
import "react-dom/server"
const originalDirectory = process.cwd()
let handler: Express
beforeAll(async () => {
  const fixture = resolve(".data/serverless-test")
  await mkdir(resolve(fixture, "dist"), { recursive: true })
  await copyFile("index.html", resolve(fixture, "dist/index.html"))
  process.chdir(fixture)
  process.env.NODE_ENV = "production"
  process.env.SITE_URL = "https://www.harshaweb.com"
  process.env.VERCEL = "1"
  handler = (await import("../server/http")).app
})
afterAll(async () => {
  process.chdir(originalDirectory)
  await (await import("../server/db")).disconnect()
})
it("exports a callable serverless handler with the real database API", async () => {
  expect(typeof handler).toBe("function")
  expect((await request(handler).get("/api/health")).body).toEqual({
    status: "ok",
    database: "connected",
  })
  expect((await request(handler).get("/api/admin/leads")).status).toBe(401)
})
it("server renders deep links and returns real 404s with indexing and cache controls", async () => {
  const { getPublicContent } = await import("../server/content")
  const { renderDocument } = await import("../server/document")
  const { readFile } = await import("node:fs/promises")
  await renderDocument(
    await readFile("dist/index.html", "utf8"),
    "/services/website-development",
    (await getPublicContent()) as never,
    "https://www.harshaweb.com"
  )
  const page = await request(handler).get("/services/website-development")
  expect(page.status).toBe(200)
  expect(page.text).toContain("<h1>")
  expect(page.text).toContain('id="initial-content"')
  expect(page.text).toContain(
    'href="https://www.harshaweb.com/services/website-development"'
  )
  expect(page.headers["cache-control"]).toBe("no-store")
  const missing = await request(handler).get("/missing-serverless-page")
  expect(missing.status).toBe(404)
  expect(missing.headers["x-robots-tag"]).toBe("noindex, nofollow")
  expect((await request(handler).get("/sitemap.xml")).text).toContain(
    "/services/website-development"
  )
})
it("sets secure session cookies behind the Vercel HTTPS proxy", async () => {
  const response = await request(handler)
    .get("/api/auth/session")
    .set("X-Forwarded-Proto", "https")
  const cookies = response.headers["set-cookie"].join(";")
  expect(cookies).toContain("Secure")
  expect(cookies).toContain("HttpOnly")
  expect(cookies).toContain("SameSite=Strict")
})
