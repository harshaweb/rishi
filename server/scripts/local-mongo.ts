import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { MongoMemoryReplSet } from "mongodb-memory-server"

export async function startLocalMongo() {
  const dbPath = resolve(".data/mongodb")
  await mkdir(dbPath, { recursive: true })
  const replica = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    instanceOpts: [{ port: 27018, dbPath }],
    replSet: {
      name: "omshivraj-local",
      count: 1,
      storageEngine: "wiredTiger",
      ip: "127.0.0.1",
    },
  })
  return {
    uri: replica.getUri("omshivraj"),
    stop: () => replica.stop({ doCleanup: false, force: false }),
  }
}
