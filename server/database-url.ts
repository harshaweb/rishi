import "dotenv/config"

export const databaseUrl =
  process.env.MONGODB_URL || process.env.DATABASE_URL || ""
export const isMongo = /^mongodb(?:\+srv)?:\/\//.test(databaseUrl)
// Prisma and administrative scripts use the same selected database.
if (databaseUrl) process.env.DATABASE_URL = databaseUrl

export function validDatabaseUrl(value: string) {
  try {
    const url = new URL(value)
    if (/[<>]/.test(value)) return false
    if (["mongodb:", "mongodb+srv:"].includes(url.protocol))
      return Boolean(url.hostname && url.pathname.length > 1)
    return ["postgres:", "postgresql:"].includes(url.protocol)
  } catch {
    return false
  }
}
