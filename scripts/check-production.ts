import { config } from "dotenv"
import pg from "pg"

// Deliberately do not load the local development .env or import server/db.
config({
  path: process.env.PRODUCTION_ENV_FILE || ".env.production",
  quiet: true,
})
const env = process.env
let failures = 0
function check(ok: boolean, description: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${description}`)
  if (!ok) failures++
}
function configured(key: string) {
  const value = env[key]?.trim() || ""
  return Boolean(value && !/[<>]|replace-with|YOUR_|PASSWORD/.test(value))
}
check(env.NODE_ENV === "production", "NODE_ENV is production")
check(
  configured("SESSION_SECRET") && (env.SESSION_SECRET?.length || 0) >= 32,
  "SESSION_SECRET is configured with at least 32 characters"
)
let database: URL | undefined
try {
  database = new URL(env.DATABASE_URL || "")
} catch {
  /* Report below. */
}
const databaseReady = Boolean(
  database &&
  configured("DATABASE_URL") &&
  ["postgres:", "postgresql:"].includes(database.protocol) &&
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(database.hostname) &&
  database.pathname.length > 1
)
check(
  databaseReady && !env.MONGODB_URL,
  "Managed PostgreSQL is configured; MongoDB override is unset"
)
let siteReady = false
try {
  const site = new URL(env.SITE_URL || "")
  siteReady =
    site.protocol === "https:" &&
    site.pathname === "/" &&
    !site.search &&
    !site.hash &&
    !site.username &&
    !site.password &&
    !["localhost", "127.0.0.1", "example.com", "www.example.com"].includes(
      site.hostname
    )
} catch {
  /* Report below. */
}
check(
  siteReady && configured("SITE_URL"),
  "SITE_URL is the actual public HTTPS origin"
)
check(env.LOCAL_POSTGRES !== "1", "Embedded development PostgreSQL is disabled")
check(
  configured("RESEND_API_KEY") && configured("EMAIL_FROM"),
  "Transactional email credentials are configured"
)
check(
  configured("S3_BUCKET") && configured("S3_REGION"),
  "Production upload bucket and region are configured (runtime storage access must also be verified)"
)
const payments = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
].every(configured)
console.log(
  payments
    ? "PASS Online-payment credentials are configured; provider checkout/webhooks still need verification"
    : "WARN Online payments unavailable; configure all Razorpay credentials before publishing PAYMENT listings"
)
if (databaseReady && !env.MONGODB_URL) {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  })
  try {
    const admins = await pool.query(
      `SELECT count(*)::int AS count FROM "RentalUser" WHERE active AND role='ADMIN'`
    )
    check(
      admins.rows[0].count > 0,
      "An active marketplace administrator exists"
    )
    const properties = await pool.query(
      `SELECT count(*) FILTER (WHERE p.demo)::int AS demos, count(*) FILTER (WHERE NOT p.demo AND u.active)::int AS real FROM "RentalProperty" p JOIN "RentalUser" u ON u.id=p."hostId" WHERE p.status='PUBLISHED'`
    )
    check(
      properties.rows[0].demos === 0,
      "Published inventory contains no demonstration listings"
    )
    check(
      properties.rows[0].real > 0,
      "At least one real published stay has an active host"
    )
    const migrations = await pool.query(
      `SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`
    )
    check(
      migrations.rows[0].count === 0,
      "No failed or unfinished database migrations (run db:migrate to apply pending releases)"
    )
  } catch {
    check(
      false,
      "Production database connection/schema check failed; verify access and apply migrations"
    )
  } finally {
    await pool.end()
  }
}
console.log(
  "This read-only check does not deploy, change data, or verify provider delivery, backups, legal content or payment settlement."
)
process.exitCode = failures ? 1 : 0
