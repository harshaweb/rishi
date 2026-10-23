import { config } from "dotenv"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

config({ path: ".env.test", override: true, quiet: true })
const database = new URL(process.env.DATABASE_URL || "")
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !["127.0.0.1", "localhost"].includes(database.hostname) ||
  database.pathname !== "/harshaweb_test" ||
  process.env.NODE_ENV !== "test"
)
  throw new Error(
    "Production checks require the isolated loopback .env.test database."
  )

Object.assign(process.env, {
  MONGODB_URL: "",
  NODE_ENV: "production",
  SITE_URL: "https://www.harshaweb.com",
  HOST: "127.0.0.1",
  PORT: "4173",
  TRUST_PROXY: "1",
  VERCEL: "",
})
const { app, disconnect } = await import(
  pathToFileURL(resolve("dist-server/http.js")).href
)
const server = app.listen(4173, "127.0.0.1", () =>
  console.log("Isolated production fixture listening on port 4173.")
)
async function stop() {
  server.close(async () => {
    await disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
