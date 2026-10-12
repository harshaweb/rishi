import assert from "node:assert/strict"
import { createServer } from "node:http"
process.env.MONGODB_URI =
  "mongodb://127.0.0.1:1/omshivraj?replicaSet=unavailable"
process.env.SESSION_SECRET =
  "unavailable-database-test-secret-at-least-32-characters"
process.env.SITE_URL = "https://www.omshivraj.test"
process.env.NODE_ENV = "production"
process.env.VERCEL = "1"
const { app, disconnect } = await import("../../dist-server/http.js")
const server = createServer(app).listen(0, "127.0.0.1")
await new Promise((resolve) => server.once("listening", resolve))
try {
  const base = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(base + "/", {
    signal: AbortSignal.timeout(45000),
  })
  assert.equal(response.status, 503)
  assert(response.headers.get("content-type").includes("text/html"))
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(response.headers.get("retry-after"), "60")
  const html = await response.text()
  assert(html.includes("Omshivraj"))
  assert(html.includes("Reference:"))
  assert(!html.includes("mongodb://"))
  const robots = await fetch(base + "/robots.txt")
  assert.equal(robots.status, 200)
  console.log(
    "PASS database outage returns safe HTML 503 and keeps server running"
  )
} finally {
  server.close()
  await disconnect()
}
