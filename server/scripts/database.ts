import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { databaseUrl, isMongo, validDatabaseUrl } from "../src/database-url.js"

const action = process.argv[2] || "generate"
if (!["generate", "deploy", "validate"].includes(action))
  throw new Error("Unknown database action.")
if (isMongo && !validDatabaseUrl(databaseUrl))
  throw new Error(
    "MongoDB URL needs a database name and real credentials; placeholders are not accepted."
  )
const schema =
  isMongo || !databaseUrl
    ? "server/prisma/schema.mongodb.prisma"
    : "server/prisma/schema.prisma"
const hash = createHash("sha256").update(readFileSync(schema)).digest("hex")
const marker = "node_modules/.prisma/client/source.sha256"
if (
  action === "generate" &&
  existsSync(marker) &&
  existsSync("node_modules/.prisma/client/index.js") &&
  readFileSync(marker, "utf8") === hash
) {
  console.log("Prisma client already matches the selected schema.")
  process.exit(0)
}
const command =
  action === "deploy"
    ? isMongo
      ? ["db", "push", "--skip-generate"]
      : ["migrate", "deploy"]
    : [action]
const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/prisma/build/index.js"),
    ...command,
    "--schema",
    schema,
  ],
  {
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  }
)
if (action === "generate" && result.status === 0) writeFileSync(marker, hash)
process.exit(result.status ?? 1)
