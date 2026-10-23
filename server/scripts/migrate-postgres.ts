import "dotenv/config"
import { MongoClient } from "mongodb"
import pg from "pg"
import { readFile } from "node:fs/promises"
const normalizeDatabaseUrl = (value: string) => {
  const url = new URL(value)
  if (!url.pathname || url.pathname === "/") url.pathname = "/omshivraj"
  return url.toString()
}

// Source is read-only. Existing destination documents are never replaced.
const source = process.env.POSTGRES_SOURCE_URL || process.env.DATABASE_URL || ""
const target = process.env.MIGRATION_MONGODB_URI || ""
if (!/^postgres(?:ql)?:/.test(source) || !/^mongodb(?:\+srv)?:/.test(target))
  throw Error(
    "Set POSTGRES_SOURCE_URL and MIGRATION_MONGODB_URI privately before migration."
  )
const local = ["localhost", "127.0.0.1", "[::1]"].includes(
  new URL(target).hostname
)
if (!local && !process.argv.includes("--allow-atlas"))
  throw Error(
    "Remote migration requires --allow-atlas. Review the source inventory first; demonstration stays are never production inventory."
  )
const pool = new pg.Pool({ connectionString: source, max: 1 })
pg.types.setTypeParser(1082, (v) => v)
const client = new MongoClient(normalizeDatabaseUrl(target))
try {
  await client.connect()
  const db = client.db()
  const sql = await pool.connect()
  try {
    await sql.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
    )
    const tables = (
      await sql.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'"
      )
    ).rows.map((r) => String(r.tablename))
    const schema = await readFile("server/prisma/schema.mongodb.prisma", "utf8")
    const cms = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1])
    if (!local && tables.includes("RentalProperty")) {
      const demos = await sql.query(
        'SELECT 1 FROM "RentalProperty" WHERE demo LIMIT 1'
      )
      if (demos.rowCount)
        throw Error(
          "Remote migration requires a reviewed source without demonstration listings."
        )
    }
    let count = 0
    for (const name of tables.filter(
      (t) => t.startsWith("Rental") || cms.includes(t)
    )) {
      if (!/^\w+$/.test(name)) throw Error("Unsafe source table name")
      const rows = (await sql.query(`SELECT * FROM "${name}"`)).rows
      for (const row of rows) {
        const id = String(
          row.id ||
            row.userId ||
            row.key ||
            row.name ||
            row.code ||
            (row.propertyId && row.night
              ? `${row.propertyId}:${row.night}`
              : row.propertyId && row.amenity
                ? `${row.propertyId}:${row.amenity}`
                : row.wishlistId && row.propertyId
                  ? `${row.wishlistId}:${row.propertyId}`
                  : "")
        )
        if (!id) throw Error(`Missing identity in ${name}`)
        const doc = { ...row, _id: id }
        if (cms.includes(name)) delete doc.id
        if (name === "BlogPost") doc.tagIds = []
        if (name === "BlogTag") doc.postIds = []
        if (name === "Service") doc.projectIds = []
        if (name === "PortfolioProject") doc.serviceIds = []
        const result = await db
          .collection(name)
          .updateOne(
            { _id: id } as never,
            { $setOnInsert: doc },
            { upsert: true }
          )
        count += result.upsertedCount
      }
    }
    for (const [table, left, leftField, right, rightField] of [
      ["_BlogPostToBlogTag", "BlogPost", "tagIds", "BlogTag", "postIds"],
      [
        "_PortfolioProjectToService",
        "PortfolioProject",
        "serviceIds",
        "Service",
        "projectIds",
      ],
    ])
      if (tables.includes(table)) {
        const rows = (await sql.query(`SELECT * FROM "${table}"`)).rows
        for (const row of rows) {
          await db
            .collection(left)
            .updateOne({ _id: row.A }, { $addToSet: { [leftField]: row.B } })
          await db
            .collection(right)
            .updateOne({ _id: row.B }, { $addToSet: { [rightField]: row.A } })
        }
      }
    await sql.query("ROLLBACK")
    console.log(
      `Migrated ${count} new records. Source PostgreSQL and existing MongoDB records were preserved.`
    )
  } finally {
    sql.release()
  }
} catch (error) {
  console.error(
    "Migration failed:",
    error instanceof Error ? error.name : "UnknownError"
  )
  process.exitCode = 1
} finally {
  await pool.end()
  await client.close()
}
