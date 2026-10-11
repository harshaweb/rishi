import { databaseUrl, isMongo } from "./database-url.js"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
import { MongoClient } from "mongodb"
import MongoStore from "connect-mongo"
// Calendar dates are not instants: preserve DATE values without local timezone conversion.
pg.types.setTypeParser(1082, (value) => value)
export const prisma = new PrismaClient()
export const pool = new pg.Pool({
  connectionString: isMongo ? undefined : databaseUrl,
  max: 8,
})
export const mongoClient = isMongo
  ? new MongoClient(databaseUrl, {
      maxPoolSize: 8,
      serverSelectionTimeoutMS: 10000,
    })
  : null
export const mongo = mongoClient?.db()
export const mongoSessionStore = mongoClient
  ? MongoStore.create({
      clientPromise: mongoClient.connect(),
      stringify: false,
      collectionName: "Session",
    })
  : null
export async function invalidateUserSessions(userId: string) {
  if (mongo)
    await mongo.collection("Session").deleteMany({ "session.userId": userId })
  else
    await pool.query("DELETE FROM \"Session\" WHERE sess->>'userId' = $1", [
      userId,
    ])
}
export async function disconnect() {
  await prisma.$disconnect()
  await pool.end()
  await mongoClient?.close()
}
