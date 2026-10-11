import { randomUUID, createHmac, timingSafeEqual } from "node:crypto"
import type { PoolClient, QueryResultRow } from "pg"
import { pool } from "./db.js"
import type { RentalProperty } from "../shared/rentals.js"
import { rentalRegionSql } from "./rental-region.js"
export const rid = () => randomUUID()
export const rentalFail = (status: number, message: string) =>
  Object.assign(new Error(message), { status })
export async function rq<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
  db: Pick<PoolClient, "query"> = pool
): Promise<T[]> {
  return (await db.query(sql, values)).rows as T[]
}
export async function rentalTransaction<T>(
  fn: (db: PoolClient) => Promise<T>
): Promise<T> {
  const db = await pool.connect()
  try {
    await db.query("BEGIN")
    const result = await fn(db)
    await db.query("COMMIT")
    return result
  } catch (error) {
    await db.query("ROLLBACK")
    if ((error as { code?: string }).code === "23505")
      throw rentalFail(
        409,
        "These dates or details have just been taken. Refresh and try again."
      )
    throw error
  } finally {
    db.release()
  }
}
export function rentalDates(
  checkIn: string,
  checkOut: string,
  allowPast = false
) {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  if (!valid(checkIn) || !valid(checkOut))
    throw rentalFail(400, "Choose valid check-in and checkout dates.")
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000
  if (
    nights < 1 ||
    nights > 90 ||
    (!allowPast && checkIn < new Date().toISOString().slice(0, 10))
  )
    throw rentalFail(400, "Choose 1–90 nights, starting today or later.")
  return nights
}
export function calculateRentalPrice(
  rate: number,
  nights: number,
  cleaning: number,
  feeBps: number,
  taxBps: number,
  discountPercent = 0
) {
  const values = [rate, nights, cleaning, feeBps, taxBps, discountPercent]
  if (
    values.some((x) => !Number.isSafeInteger(x) || x < 0) ||
    rate < 1 ||
    nights < 1 ||
    nights > 90 ||
    discountPercent > 50 ||
    feeBps > 3000 ||
    taxBps > 4000
  )
    throw rentalFail(400, "Invalid pricing configuration.")
  const nightlySubtotal = rate * nights
  const discount = Math.floor((nightlySubtotal * discountPercent) / 100)
  const platformFee = Math.round(
    ((nightlySubtotal - discount) * feeBps) / 10000
  )
  const tax = Math.round(
    ((nightlySubtotal - discount + cleaning + platformFee) * taxBps) / 10000
  )
  const total = nightlySubtotal - discount + cleaning + platformFee + tax
  if (!Number.isSafeInteger(total) || total > 2000000000)
    throw rentalFail(400, "This booking exceeds the supported amount.")
  return {
    nights,
    nightlySubtotal,
    cleaningFee: cleaning,
    platformFee,
    tax,
    discount,
    total,
    currency: "INR",
  }
}
export function verifyRentalSignature(
  message: string | Buffer,
  signature: string,
  secret: string
) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(
      createHmac("sha256", secret).update(message).digest("hex"),
      "hex"
    )
  )
}
export const propertySelect = `SELECT p.*, u.name AS "hostName", COALESCE((SELECT json_agg(i.url ORDER BY i.position) FROM "RentalPropertyImage" i WHERE i."propertyId"=p.id),'[]') AS images, COALESCE((SELECT json_agg(a.amenity) FROM "RentalPropertyAmenity" a WHERE a."propertyId"=p.id),'[]') AS amenities, (SELECT avg(r.rating)::float FROM "RentalReview" r WHERE r."propertyId"=p.id AND r.visible) AS rating, (SELECT count(*)::int FROM "RentalReview" r WHERE r."propertyId"=p.id AND r.visible) AS "reviewCount" FROM "RentalProperty" p JOIN "RentalUser" u ON u.id=p."hostId"`
export async function publicRentals(slug?: string) {
  return rq<RentalProperty>(
    propertySelect +
      ` WHERE p.status='PUBLISHED' AND u.active AND ${rentalRegionSql()} AND EXISTS (SELECT 1 FROM "RentalCategory" c WHERE c.name=p.category AND c.active) ${slug ? "AND p.slug=$1" : ""} ORDER BY p."createdAt" DESC LIMIT 48`,
    slug ? [slug] : []
  )
}
export async function expireRentals(
  db: Pick<PoolClient, "query"> = pool,
  propertyId?: string
) {
  await rq(
    `WITH expired AS (UPDATE "RentalBooking" SET status='CANCELLED', "cancelReason"='Reservation hold expired' WHERE status='PENDING' AND "expiresAt"<now() ${propertyId ? 'AND "propertyId"=$1' : ""} RETURNING id) DELETE FROM "RentalBookingNight" WHERE "bookingId" IN (SELECT id FROM expired)`,
    propertyId ? [propertyId] : [],
    db
  )
}
export async function rentalAvailable(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  db: Pick<PoolClient, "query"> = pool
) {
  const conflicts = await rq(
    `SELECT id FROM "RentalBlockedDate" WHERE "propertyId"=$1 AND start<$3::date AND "end">$2::date UNION ALL SELECT n."bookingId" AS id FROM "RentalBookingNight" n JOIN "RentalBooking" b ON b.id=n."bookingId" WHERE n."propertyId"=$1 AND n.night>=$2::date AND n.night<$3::date AND (b.status IN ('CONFIRMED','COMPLETED') OR (b.status='PENDING' AND b."expiresAt">now())) LIMIT 1`,
    [propertyId, checkIn, checkOut],
    db
  )
  return conflicts.length === 0
}
export async function quoteRental(
  property: QueryResultRow,
  checkIn: string,
  checkOut: string,
  code = "",
  db: Pick<PoolClient, "query"> = pool
) {
  const nights = rentalDates(checkIn, checkOut)
  const settings = await rq(
    `SELECT key,value FROM "RentalSetting" WHERE key IN ('platformFeeBps','taxBps')`,
    [],
    db
  )
  const config = Object.fromEntries(
    settings.map((x) => [x.key, Number(x.value)])
  )
  let percent = Number(property.discountPercent || 0)
  if (code) {
    const [coupon] = await rq(
      `SELECT percent FROM "RentalCoupon" WHERE code=$1 AND active AND "expiresAt">now()`,
      [code.toUpperCase()],
      db
    )
    if (!coupon) throw rentalFail(400, "This promotion is not available.")
    percent = Math.max(percent, coupon.percent)
  }
  return calculateRentalPrice(
    property.nightlyRate,
    nights,
    property.cleaningFee,
    config.platformFeeBps ?? 500,
    config.taxBps ?? 0,
    percent
  )
}
export async function rentalAudit(
  userId: string,
  action: string,
  entityId: string,
  db: Pick<PoolClient, "query"> = pool
) {
  await rq(
    `INSERT INTO "RentalAudit" (id,"userId",action,"entityId") VALUES ($1,$2,$3,$4)`,
    [rid(), userId, action, entityId],
    db
  )
}
export async function rentalNotify(userId: string, body: string, link: string) {
  const id = rid()
  await rq(
    `INSERT INTO "RentalNotification" (id,"userId",body,link) VALUES ($1,$2,$3,$4)`,
    [id, userId, body, link]
  )
  const [user] = await rq(
    `SELECT u.email, COALESCE(p.notifications,true) AS notifications FROM "RentalUser" u LEFT JOIN "RentalProfile" p ON p."userId"=u.id WHERE u.id=$1`,
    [userId]
  )
  if (!user?.notifications) return
  const status = await rentalEmail(
    user.email,
    body,
    `Open your Omshivraj account: ${process.env.SITE_URL}${link}`
  )
  await rq(`UPDATE "RentalNotification" SET "emailStatus"=$2 WHERE id=$1`, [
    id,
    status,
  ])
}
export async function rentalEmail(
  email: string,
  subject: string,
  text: string
) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return "NOT_CONFIGURED"
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    })
    return r.ok ? "PROVIDER_ACCEPTED" : "FAILED"
  } catch {
    return "FAILED"
  }
}
export async function razorpay(path: string, method = "GET", body?: unknown) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw rentalFail(
      503,
      "Online payments are not configured. No charge has been made."
    )
  const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok)
    throw rentalFail(
      502,
      "The payment provider could not complete this request."
    )
  return (await r.json()) as QueryResultRow
}
export function rentalRefundAmount(
  total: number,
  policy: string,
  checkIn: string,
  now = Date.now()
) {
  const hours = (Date.parse(checkIn) - now) / 3600000
  if (hours <= 0) return 0
  if (policy === "FLEXIBLE") return hours >= 24 ? total : Math.floor(total / 2)
  if (policy === "MODERATE") return hours >= 120 ? total : Math.floor(total / 2)
  return hours >= 168 ? Math.floor(total / 2) : 0
}
