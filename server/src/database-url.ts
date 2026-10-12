import "dotenv/config"

export function normalizeDatabaseUrl(value: string) {
  if (!/^mongodb(?:\+srv)?:\/\//.test(value)) return value
  const url = new URL(value)
  if (!url.pathname || url.pathname === "/") url.pathname = "/omshivraj"
  return url.toString()
}
export const databaseUrl = normalizeDatabaseUrl(
  process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL || ""
)
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
