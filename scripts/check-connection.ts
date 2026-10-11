import { randomUUID } from "node:crypto"
import {
  databaseUrl,
  isMongo,
  validDatabaseUrl,
} from "../server/database-url.js"
import { disconnect, pool } from "../server/db.js"

async function check() {
  if (isMongo || !validDatabaseUrl(databaseUrl))
    throw new Error(
      "Configure a valid PostgreSQL DATABASE_URL and leave MONGODB_URL unset for Omshivraj."
    )

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const key = `connection-check-${randomUUID()}`
    await client.query(
      `INSERT INTO "RentalSetting" (key,value) VALUES ($1,'verified')`,
      [key]
    )
    const { rows } = await client.query(
      `SELECT value FROM "RentalSetting" WHERE key=$1`,
      [key]
    )
    if (rows[0]?.value !== "verified")
      throw new Error("Database write/read check failed.")
    await client.query("ROLLBACK")
    const remaining = await client.query(
      `SELECT key FROM "RentalSetting" WHERE key=$1`,
      [key]
    )
    if (remaining.rowCount) throw new Error("Database rollback check failed.")
    console.log(
      "PASS PostgreSQL read, write and rollback; no test records retained."
    )
  } finally {
    await client.query("ROLLBACK").catch(() => {})
    client.release()
  }

  const base = (process.env.SITE_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  )
  const checks = [
    {
      path: "/api/health",
      valid: (data: Record<string, unknown>) => data.database === "connected",
    },
    {
      path: "/api/rental/session",
      valid: (data: Record<string, unknown>) => typeof data.csrf === "string",
    },
    {
      path: "/api/rental/search",
      valid: (data: Record<string, unknown>) => Array.isArray(data.items),
    },
    {
      path: "/api/rental/config",
      valid: (data: Record<string, unknown>) =>
        typeof data.settings === "object" && data.settings !== null,
    },
  ]
  for (const { path, valid } of checks) {
    const response = await fetch(base + path, {
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok || !valid(await response.json()))
      throw new Error(
        `Connection check failed for ${path} (HTTP ${response.status}). Start the app with npm run dev.`
      )
    console.log(`PASS frontend → backend → database: ${path}`)
  }
  const protectedResponse = await fetch(base + "/api/rental/admin/overview", {
    signal: AbortSignal.timeout(15000),
  })
  if (protectedResponse.status !== 401)
    throw new Error(
      "Admin access check failed: anonymous requests must return 401."
    )
  console.log("PASS administrator data requires authentication.")
}

try {
  await check()
  console.log("Omshivraj frontend, backend and PostgreSQL connection verified.")
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.replace(
          /(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s]+/gi,
          "[database URL redacted]"
        )
      : "Connection verification failed."
  )
  process.exitCode = 1
} finally {
  await disconnect()
}
