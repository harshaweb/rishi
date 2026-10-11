import "dotenv/config"
import EmbeddedPostgres from "embedded-postgres"
import { access } from "node:fs/promises"
import { resolve } from "node:path"
import { spawn } from "node:child_process"
export async function startLocalDatabase() {
  const url = new URL(process.env.DATABASE_URL!)
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    process.env.LOCAL_POSTGRES !== "1"
  )
    throw new Error(
      "Embedded PostgreSQL is only available for explicitly enabled loopback development databases."
    )
  const directory = resolve(".data/postgres")
  let startupLog = ""
  const postgres = new EmbeddedPostgres({
    databaseDir: directory,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: Number(url.port),
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: (message) => {
      startupLog = (startupLog + String(message)).slice(-4000)
    },
    onError: (message) => {
      if (
        String(message).includes("FATAL") ||
        String(message).includes("ERROR")
      )
        console.error(
          String(message).replaceAll(
            decodeURIComponent(url.password),
            "[redacted]"
          )
        )
    },
  })
  // The package's Windows taskkill can leave PostgreSQL I/O workers alive.
  // pg_ctl asks the server to shut down its own workers and checkpoint safely.
  if (process.platform === "win32") {
    const binaryPackage = "@embedded-postgres/windows-x64"
    const { pg_ctl } = await import(binaryPackage)
    let started = false
    const start = postgres.start.bind(postgres)
    postgres.start = async () => {
      await start()
      started = true
    }
    postgres.stop = async () => {
      if (!started) return
      await new Promise<void>((done, reject) => {
        const child = spawn(
          pg_ctl,
          ["-D", directory, "-m", "fast", "-w", "-t", "15", "stop"],
          { windowsHide: true, stdio: "ignore" }
        )
        child.once("error", reject)
        child.once("exit", (code) =>
          code === 0 ? done() : reject(new Error("PostgreSQL shutdown failed."))
        )
      })
      started = false
    }
  }
  try {
    await access(resolve(directory, "PG_VERSION"))
  } catch {
    await postgres.initialise()
  }
  try {
    await postgres.start()
  } catch {
    throw new Error(
      `Local PostgreSQL could not start. Check port ${url.port} and the previous development process. ${startupLog.replaceAll(decodeURIComponent(url.password), "[redacted]")}`
    )
  }
  const client = postgres.getPgClient()
  await client.connect()
  const name = url.pathname.slice(1)
  if (!/^[a-z0-9_]+$/.test(name))
    throw new Error(
      "Local database name must use lowercase letters, digits and underscores."
    )
  const found = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [name]
  )
  if (!found.rowCount) await postgres.createDatabase(name)
  await client.end()
  console.log("Local PostgreSQL is ready on loopback.")
  return postgres
}
