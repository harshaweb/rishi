import { MongoMemoryReplSet } from "mongodb-memory-server"
import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
// Every run owns a fresh disposable replica set. Never touches Atlas or local inventory.
const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.14" },
  replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
})
try {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/tests/mongodb.integration.ts"],
    {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_URI: replica.getUri("omshivraj_test"),
        MONGODB_URL: "",
        DATABASE_URL: replica.getUri("omshivraj_test"),
        SESSION_SECRET: randomBytes(48).toString("hex"),
        SITE_URL: "http://localhost:5173",
        RESEND_API_KEY: "",
        EMAIL_FROM: "",
        LOCAL_POSTGRES: "0",
      },
    }
  )
  process.exitCode = await new Promise<number>((resolve) =>
    child.on("exit", (code) => resolve(code ?? 1))
  )
} finally {
  await replica.stop()
}
