import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
export const prisma = new PrismaClient()
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
})
export async function disconnect() {
  await prisma.$disconnect()
  await pool.end()
}
