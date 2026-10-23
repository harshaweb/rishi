import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { randomBytes } from "node:crypto"
import { mkdtemp, cp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import assert from "node:assert/strict"

// Copy outside the repository so omitted dependencies cannot resolve from its
// parent node_modules. Match Vercel's disabled require(ESM) runtime condition.
const isolated = await mkdtemp(resolve(tmpdir(), "omshivraj-function-test-"))
await cp(resolve(".vercel/output/functions/server.func"), isolated, { recursive: true })
// Uses the running local replica set, never the private Atlas URL from .env.
const child = spawn(
  process.execPath,
  [
    "--no-experimental-require-module",
    "--input-type=module",
    "-e",
    'import http from "node:http"; import handler from "./server/api/index.js"; http.createServer(handler).listen(4174,"127.0.0.1");',
  ],
  {
    cwd: isolated,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      VERCEL: "1",
      MONGODB_URI:
        "mongodb://127.0.0.1:27018/omshivraj?replicaSet=omshivraj-local",
      MONGODB_URL: "",
      SESSION_SECRET: randomBytes(48).toString("hex"),
      SITE_URL: "https://www.omshivraj.test",
    },
  }
)
child.stderr.on("data", (data) => process.stderr.write(data))
try {
  let ready = false
  for (let i = 0; i < 30; i++) {
    try {
      await fetch("http://127.0.0.1:4174/api/health")
      ready = true
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  assert(ready, "Packaged function started")
  for (const path of [
    "/api/health",
    "/api/rental/session",
    "/api/rental/search",
    "/",
    "/search?destination=Delhi",
    "/stays/delhi-apartment-2",
    "/login",
    "/signup",
    "/trips",
    "/admin",
    "/sitemap.xml",
    "/robots.txt",
  ]) {
    const response = await fetch("http://127.0.0.1:4174" + path)
    assert.equal(response.status, 200, `${path}: expected success`)
    const body = await response.text()
    if (path.startsWith("/api/")) JSON.parse(body)
    else if (!["/sitemap.xml", "/robots.txt"].includes(path)) {
      assert(
        body.includes('id="initial-content"'),
        `${path}: server-rendered content`
      )
      assert(!body.includes("We’ll be back shortly"))
    }
    console.log(`PASS packaged production function ${path}`)
  }
  const missing = await fetch("http://127.0.0.1:4174/missing-route")
  assert.equal(missing.status, 404)
  console.log("PASS packaged function returns real 404s")
} finally {
  const exited = new Promise((resolve) => child.once("exit", resolve))
  child.kill("SIGTERM")
  await exited
  assert.equal(resolve(isolated, ".."), resolve(tmpdir()))
  await rm(isolated, { recursive: true, force: true })
}
