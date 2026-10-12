import { setupLocal } from "./setup-local.js"
import { config } from "dotenv"
import { isMongo } from "../src/database-url.js"
import { spawn, type ChildProcess } from "node:child_process"
import { resolve } from "node:path"
await setupLocal()
config({ quiet: true })
const children: ChildProcess[] = []
let postgres: Awaited<
  ReturnType<typeof import("./local-db.js").startLocalDatabase>
> | null = null
function run(args: string[], wait = true) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    })
    children.push(child)
    child.once("error", reject)
    child.once("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`Child process exited with ${code}`))
    )
    if (!wait) resolvePromise()
  })
}
let stopping = false
async function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  await Promise.all(
    children
      .filter((child) => child.exitCode === null && child.signalCode === null)
      .map((child) => {
        if (process.platform !== "win32" || !child.pid) {
          child.kill()
          return Promise.resolve()
        }
        return new Promise<void>((done) => {
          const killer = spawn(
            "taskkill",
            ["/pid", String(child.pid), "/t", "/f"],
            { windowsHide: true, stdio: "ignore" }
          )
          killer.once("exit", () => done())
          killer.once("error", () => {
            child.kill()
            done()
          })
        })
      })
  )
  if (postgres) await postgres.stop()
  process.exit(exitCode)
}
process.on("SIGINT", () => void stop())
process.on("SIGTERM", () => void stop())
try {
  postgres =
    !isMongo && process.env.LOCAL_POSTGRES === "1"
      ? await (await import("./local-db.js")).startLocalDatabase()
      : null
  await run(["--import", "tsx", "server/scripts/database.ts", "generate"])
  await run(["--import", "tsx", "server/scripts/database.ts", "deploy"])
  const { PrismaClient } = await import("@prisma/client")
  const database = new PrismaClient()
  const initialized = await database.siteSetting.count()
  await database.$disconnect()
  if (!initialized && !isMongo) await run(["--import", "tsx", "server/prisma/seed.ts"])
  if (isMongo) await (await import("../src/mongo-rental-store.js")).initializeRentals()
  await run(["--watch", "--import", "tsx", "server/src/index.ts"], false)
  await run(
    [resolve("node_modules/vite/bin/vite.js"), "--config", "frontend/vite.config.ts", "--host", "127.0.0.1"],
    false
  )
  console.log("Harshaweb development starting: http://localhost:5173")
  for (const child of children.slice(-2))
    child.on("exit", () => {
      if (!stopping) void stop()
    })
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Development startup failed."
  )
  await stop(1)
}
