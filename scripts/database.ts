import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import {
  databaseUrl,
  isMongo,
  validDatabaseUrl,
} from "../server/database-url.js"

const action = process.argv[2] || "generate"
if (!["generate", "deploy", "validate"].includes(action))
  throw new Error("Unknown database action.")
if (isMongo && !validDatabaseUrl(databaseUrl))
  throw new Error(
    "MongoDB URL needs a database name and real credentials; placeholders are not accepted."
  )
const schema = isMongo ? "prisma/schema.mongodb.prisma" : "prisma/schema.prisma"
const command =
  action === "deploy"
    ? isMongo
      ? ["db", "push"]
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
process.exit(result.status ?? 1)
