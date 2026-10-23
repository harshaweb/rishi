import { config } from "dotenv"
import { MongoClient } from "mongodb"
config({
  path: process.env.PRODUCTION_ENV_FILE || ".env.production",
  quiet: true,
})
const env = process.env
let failures = 0
function check(ok: boolean, label: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failures++
}
const uri = env.MONGODB_URI || env.MONGODB_URL || ""
let url: URL | undefined
try {
  url = new URL(uri)
  if (!url.pathname || url.pathname === "/") url.pathname = "/omshivraj"
} catch {
  /* Report safely. */
}
const databaseReady = Boolean(
  url &&
  ["mongodb:", "mongodb+srv:"].includes(url.protocol) &&
  !/[<>]/.test(uri) &&
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
)
check(databaseReady, "Hosted MongoDB URI has real credentials")
check(env.NODE_ENV === "production", "NODE_ENV is production")
check(
  (env.SESSION_SECRET?.length || 0) >= 32,
  "SESSION_SECRET has at least 32 characters"
)
let siteReady = false
try {
  const u = new URL(env.SITE_URL || "")
  siteReady =
    u.protocol === "https:" &&
    !u.username &&
    !u.password &&
    u.pathname === "/" &&
    !u.search &&
    !u.hash &&
    !["localhost", "127.0.0.1", "example.com"].includes(u.hostname)
} catch {
  /* Report safely. */
}
check(siteReady, "SITE_URL is the public HTTPS origin")
check(
  Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  "Transactional email is configured"
)
check(
  Boolean((env.S3_BUCKET && env.S3_REGION) || databaseReady),
  "Persistent production upload storage is configured"
)
console.log(
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET
    ? "PASS Payment credentials configured; verify provider delivery separately"
    : "WARN Configure all Razorpay keys before publishing PAYMENT listings"
)
if (databaseReady) {
  const client = new MongoClient(url!.toString(), {
    serverSelectionTimeoutMS: 10000,
  })
  try {
    await client.connect()
    const hello = await client.db().command({ hello: 1 })
    check(
      Boolean(hello.setName || hello.msg === "isdbgrid"),
      "MongoDB supports booking transactions"
    )
    check(
      (await client
        .db()
        .collection("RentalUser")
        .countDocuments({ active: true, role: "ADMIN" })) > 0,
      "Active admin exists"
    )
    check(
      (await client
        .db()
        .collection("RentalProperty")
        .countDocuments({ status: "PUBLISHED", demo: true })) === 0,
      "Production has no demonstration listings"
    )
    check(
      (await client
        .db()
        .collection("RentalProperty")
        .countDocuments({ status: "PUBLISHED", demo: false })) > 0,
      "Real published inventory exists"
    )
    const published = await client
      .db()
      .collection("RentalProperty")
      .find(
        { status: "PUBLISHED" },
        { projection: { address: 1, city: 1, bookingMode: 1 } }
      )
      .toArray()
    const incompleteAddresses = published.filter((property) => {
      const normalize = (value: unknown) =>
        String(value || "")
          .replace(/[\s,]/g, "")
          .toLowerCase()
      const address = normalize(property.address),
        city = normalize(property.city)
      return (
        !address ||
        [city, `${city}india`, `${city}delhincrindia`].includes(address)
      )
    })
    check(
      incompleteAddresses.length === 0,
      `Full property addresses supplied (${incompleteAddresses.length} published listings need updating)`
    )
    if (published.some((property) => property.bookingMode === "PAYMENT"))
      check(
        Boolean(
          env.RAZORPAY_KEY_ID &&
          env.RAZORPAY_KEY_SECRET &&
          env.RAZORPAY_WEBHOOK_SECRET
        ),
        "Online-payment listings have complete payment configuration"
      )
  } catch {
    check(
      false,
      "Atlas connection failed; check cluster status, credentials and Network Access"
    )
  } finally {
    await client.close()
  }
}
process.exitCode = failures ? 1 : 0
