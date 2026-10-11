import "dotenv/config"
import { randomBytes } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import pg from "pg"
const url = new URL(process.env.DATABASE_URL!)
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Tests require an isolated loopback PostgreSQL database.")
url.pathname = "/harshaweb_test"
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  const found = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    ["harshaweb_test"]
  )
  if (!found.rowCount) await client.query('CREATE DATABASE "harshaweb_test"')
} finally {
  await client.end()
}
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  SESSION_SECRET: randomBytes(48).toString("hex"),
  NODE_ENV: "test",
  TEST_ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
  SITE_URL: "http://localhost:5173",
}
await writeFile(
  ".env.test",
  Object.entries({
    DATABASE_URL: env.DATABASE_URL,
    SESSION_SECRET: env.SESSION_SECRET,
    NODE_ENV: env.NODE_ENV,
    TEST_ADMIN_PASSWORD: env.TEST_ADMIN_PASSWORD,
    SITE_URL: env.SITE_URL,
  })
    .map(([key, value]) => `${key}=${value}`)
    .join("\n"),
  { mode: 0o600 }
)
for (const args of [
  [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
  ["--import", "tsx", "prisma/seed.ts"],
]) {
  const child = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit",
    windowsHide: true,
  })
  if (child.status !== 0) throw new Error("Test database preparation failed.")
}
console.log("Isolated test PostgreSQL database prepared.")
