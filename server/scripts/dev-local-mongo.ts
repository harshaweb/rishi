import "dotenv/config"
import { access, writeFile } from "node:fs/promises"
import { startLocalMongo } from "./local-mongo.js"
import { spawn } from "node:child_process"
const database = await startLocalMongo()
console.log(
  "Local MongoDB replica set ready on port 27018 (persistent .data/mongodb)."
)
const source = process.env.POSTGRES_SOURCE_URL || process.env.DATABASE_URL || ""
let migrated = false
try {
  await access(".data/mongodb/postgres-migrated.json")
  migrated = true
} catch {
  /* First migration only. */
}
if (!migrated && /^postgres(?:ql)?:/.test(source)) {
  const postgres =
    process.env.LOCAL_POSTGRES === "1"
      ? await (await import("./local-db.js")).startLocalDatabase()
      : null
  const migration = spawn(
    process.execPath,
    ["--import", "tsx", "server/scripts/migrate-postgres.ts"],
    {
      env: {
        ...process.env,
        POSTGRES_SOURCE_URL: source,
        MIGRATION_MONGODB_URI: database.uri,
      },
      stdio: "inherit",
      windowsHide: true,
    }
  )
  const code = await new Promise<number | null>((resolve) =>
    migration.once("exit", resolve)
  )
  await postgres?.stop()
  if (code) {
    await database.stop()
    throw Error("Local migration failed; source data was preserved.")
  }
  await writeFile(
    ".data/mongodb/postgres-migrated.json",
    JSON.stringify({ completedAt: new Date().toISOString() })
  )
}
const child = spawn(
  process.execPath,
  ["--import", "tsx", "server/scripts/dev.ts"],
  {
    env: {
      ...process.env,
      MONGODB_URI: database.uri,
      LOCAL_MONGODB: "0",
      LOCAL_POSTGRES: "0",
    },
    stdio: "inherit",
    windowsHide: true,
  }
)
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  child.kill("SIGINT")
  await database.stop()
}
process.on("SIGINT", () => void stop())
process.on("SIGTERM", () => void stop())
child.on("exit", async (code) => {
  await stop()
  process.exitCode = code || 0
})
