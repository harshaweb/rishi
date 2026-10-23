import "dotenv/config"
import { MongoClient } from "mongodb"
import { databaseUrl, isMongo } from "../src/database-url.js"
if (!isMongo) throw Error("Set MONGODB_URI in the ignored .env file.")
const client = new MongoClient(databaseUrl, { serverSelectionTimeoutMS: 10000 })
try {
  await client.connect()
  await client.db().command({ ping: 1 })
  const hello = await client.db().command({ hello: 1 })
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw Error("Use an Atlas cluster or replica set for booking transactions.")
  const session = client.startSession()
  const id = `check-${Date.now()}`
  try {
    session.startTransaction()
    const store = client.db().collection("ConnectionCheck")
    await store.insertOne({ marker: id }, { session })
    if (!(await store.findOne({ marker: id }, { session })))
      throw Error("Read/write check failed.")
    await session.abortTransaction()
    if (await store.findOne({ marker: id }))
      throw Error("Rollback check failed.")
  } finally {
    await session.endSession()
  }
  console.log(
    "PASS MongoDB ping, replica set, transaction read/write and rollback. No test records retained."
  )
} catch (error) {
  console.error(
    "MongoDB connection check failed:",
    error instanceof Error ? error.name : "UnknownError"
  )
  process.exitCode = 1
} finally {
  await client.close()
}
