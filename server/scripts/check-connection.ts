import { databaseUrl, isMongo, validDatabaseUrl } from "../src/database-url.js"
import { disconnect, pool } from "../src/db.js"

async function check() {
  if (!validDatabaseUrl(databaseUrl))
    throw new Error("Configure a valid database URL.")
  if (isMongo) {
    const { spawnSync } = await import("node:child_process")
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "server/scripts/check-mongo.ts"],
      { env: process.env, stdio: "inherit", windowsHide: true }
    )
    if (result.status) throw new Error("MongoDB connectivity check failed.")
  } else {
    const client = await pool.connect()
    try {
      await client.query("SELECT 1")
    } finally {
      client.release()
    }
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
