import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { createHash, randomBytes } from "node:crypto"
import multer from "multer"
import { rateLimit } from "express-rate-limit"
import { rateStore } from "./rate-store.js"
import { isMongo } from "./database-url.js"
import { saveFile } from "./storage.js"
import { parsePatch } from "./validation.js"
import { rentalAmenities } from "../shared/rentals.js"
import { rentalCity, rentalDestination } from "../shared/rental-region.js"
import { rentalRegionSql } from "./rental-region.js"
import { rentalHours } from "./rental-utils.js"
import {
  rid,
  rq,
  rentalFail as fail,
  rentalTransaction as tx,
  propertySelect,
  rentalDates,
  rentalAvailable,
  quoteRental,
  expireRentals,
  rentalAudit,
  rentalEmail,
  rentalNotify,
  razorpay,
  verifyRentalSignature,
  rentalRefundAmount,
} from "./rental-core.js"
declare module "express-session" {
  interface SessionData {
    rentalUserId?: string
    rentalVersion?: number
  }
}
declare global {
  // Express request augmentation requires the library's global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rentalUser?: {
        id: string
        name: string
        email: string
        role: string
        verified: boolean
        sessionVersion: number
      }
    }
  }
}
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
const userPublic = `u.id,u.name,u.email,u.role,u.verified,p.phone,p.photo,p.notifications`
const current = async (req: Request) => {
  if (!req.session.rentalUserId) return null
  const [u] = await rq(
    `SELECT ${userPublic},u."sessionVersion" FROM "RentalUser" u LEFT JOIN "RentalProfile" p ON p."userId"=u.id WHERE u.id=$1 AND u.active`,
    [req.session.rentalUserId]
  )
  return u && u.sessionVersion === req.session.rentalVersion ? u : null
}
// Async authorization must call next after populating the server-verified identity.
const signed = (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(current(req))
    .then((u) => {
      if (!u) return next(fail(401, "Please log in to continue."))
      req.rentalUser = u as NonNullable<Request["rentalUser"]>
      next()
    })
    .catch(next)
}
const role =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    roles.includes(req.rentalUser?.role || "")
      ? next()
      : next(fail(403, "This action is not permitted for your account."))
const safeEmail = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase())
const text = (max = 1000) => z.string().trim().min(1).max(max)
const password = z.string().min(12).max(72)
const dateInput = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  bookingType: z.enum(["OVERNIGHT", "HOURLY"]).default("OVERNIGHT"),
  arrivalTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).default("10:00"),
  departureTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).default("13:00"),
  guests: z.coerce.number().int().min(1).max(30),
  coupon: z.string().max(50).default(""),
})
const propertySchema = z.object({
  checkInTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("15:00"),
  checkOutTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("11:00"),
  houseRules: text(3000).default("No parties or smoking indoors."),
  discountPercent: z.coerce.number().int().min(0).max(50).default(0),
  title: text(150),
  slug: text(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  city: text(100)
    .refine(
      (city) => Boolean(rentalCity(city)),
      "Choose a city in Delhi NCR: Delhi, Gurugram, Noida, Greater Noida, Ghaziabad or Faridabad."
    )
    .transform((city) => rentalCity(city)!),
  address: text(400),
  category: text(100),
  type: z.enum(["Apartment", "Villa", "Cottage", "Cabin", "Homestay", "House"]),
  description: text(10000),
  nightlyRate: z.coerce.number().int().min(10000).max(100000000),
  cleaningFee: z.coerce.number().int().min(0).max(10000000).default(0),
  capacity: z.coerce.number().int().min(1).max(30),
  bedrooms: z.coerce.number().int().min(0).max(20),
  beds: z.coerce.number().int().min(1).max(30),
  bathrooms: z.coerce.number().int().min(1).max(20),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  cancellation: z.enum(["FLEXIBLE", "MODERATE", "STRICT"]).default("FLEXIBLE"),
  bookingMode: z.enum(["HOST_APPROVAL", "PAYMENT"]).default("HOST_APPROVAL"),
  instantBook: z.boolean().default(false),
  amenities: z
    .array(z.enum(rentalAmenities as [string, ...string[]]))
    .max(20)
    .default([]),
})
export const rentalRouter = express.Router()
rentalRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  if (isMongo)
    return next(
      fail(503, "The rental marketplace requires its PostgreSQL database.")
    )
  next()
})
rentalRouter.use((req, _res, next) => {
  if (
    !["GET", "HEAD"].includes(req.method) &&
    (!req.session.csrf || req.headers["x-csrf-token"] !== req.session.csrf)
  )
    return next(fail(403, "Refresh the page to renew your security token."))
  next()
})
const sensitive = rateLimit({
  windowMs: 15 * 60000,
  limit: 25,
  store: rateStore("rental-auth:"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
})
const messagesLimit = rateLimit({
  windowMs: 60000,
  limit: 20,
  store: rateStore("rental-message:"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
})
const tokenHash = (s: string) => createHash("sha256").update(s).digest("hex")
async function issueToken(id: string, email: string, kind: string) {
  const value = randomBytes(32).toString("base64url")
  await rq(
    `INSERT INTO "RentalToken" (id,"userId",hash,kind,"expiresAt") VALUES ($1,$2,$3,$4,now()+interval '1 hour')`,
    [rid(), id, tokenHash(value), kind]
  )
  const link = `${process.env.SITE_URL || "http://localhost:5173"}/${kind === "VERIFY" ? "verify-email" : "reset-password"}?token=${value}`
  const status = await rentalEmail(
    email,
    kind === "VERIFY"
      ? "Verify your Omshivraj email"
      : "Reset your Omshivraj password",
    `Use this link within one hour: ${link}`
  )
  return {
    emailStatus: status,
    ...(process.env.NODE_ENV !== "production" ? { developmentLink: link } : {}),
  }
}
rentalRouter.get(
  "/session",
  wrap(async (req, res) => {
    req.session.csrf ||= rid()
    res.json({
      user: await current(req),
      csrf: req.session.csrf,
      paymentsConfigured: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
      ),
      mapsToken: process.env.MAPBOX_PUBLIC_TOKEN || "",
      emailConfigured: Boolean(
        process.env.RESEND_API_KEY && process.env.EMAIL_FROM
      ),
    })
  })
)
rentalRouter.post(
  "/signup",
  sensitive,
  wrap(async (req, res) => {
    const data = z
      .object({
        name: text(100),
        email: safeEmail,
        password,
        consent: z.literal(true),
      })
      .parse(req.body)
    const id = rid(),
      hash = await bcrypt.hash(data.password, 12)
    await tx(async (db) => {
      if (
        (
          await rq(
            `SELECT id FROM "RentalUser" WHERE email=$1`,
            [data.email],
            db
          )
        ).length
      )
        throw fail(409, "This email is already registered.")
      await rq(
        `INSERT INTO "RentalUser" (id,name,email,"passwordHash") VALUES ($1,$2,$3,$4)`,
        [id, data.name, data.email, hash],
        db
      )
      await rq(`INSERT INTO "RentalProfile" ("userId") VALUES ($1)`, [id], db)
    })
    res.status(201).json({
      message:
        "Your account was created. Verify your email before requesting a stay.",
      ...(await issueToken(id, data.email, "VERIFY")),
    })
  })
)
rentalRouter.post(
  "/login",
  sensitive,
  wrap(async (req, res) => {
    const data = z
      .object({ email: safeEmail, password: z.string().max(72) })
      .parse(req.body)
    const [u] = await rq(`SELECT * FROM "RentalUser" WHERE email=$1`, [
      data.email,
    ])
    const ok = await bcrypt.compare(
      data.password,
      u?.passwordHash ||
        "$2b$12$LdDg9hvgCDfVYN3mzgq5tuS/uYfY4RNUDeQ.PjgtPxkqD/txVcu42"
    )
    if (!ok || !u?.active) throw fail(401, "Email or password is incorrect.")
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve()))
    )
    req.session.rentalUserId = u.id
    req.session.rentalVersion = u.sessionVersion
    req.session.csrf = rid()
    res.json({ user: await current(req), csrf: req.session.csrf })
  })
)
rentalRouter.post(
  "/logout",
  signed,
  wrap(async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((e) => (e ? reject(e) : resolve()))
    )
    res.clearCookie("harshaweb.sid", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    })
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/forgot-password",
  sensitive,
  wrap(async (req, res) => {
    const { email } = z.object({ email: safeEmail }).parse(req.body)
    const [u] = await rq(
      `SELECT id FROM "RentalUser" WHERE email=$1 AND active`,
      [email]
    )
    const result = u ? await issueToken(u.id, email, "RESET") : {}
    res.json({
      message:
        "If an account exists, password reset instructions have been requested.",
      ...result,
    })
  })
)
rentalRouter.post(
  "/resend-verification",
  sensitive,
  signed,
  wrap(async (req, res) => {
    res.json(
      await issueToken(req.rentalUser!.id, req.rentalUser!.email, "VERIFY")
    )
  })
)
rentalRouter.post(
  "/verify-email",
  sensitive,
  wrap(async (req, res) => {
    const { token } = z.object({ token: text(100) }).parse(req.body)
    await tx(async (db) => {
      const [t] = await rq(
        `UPDATE "RentalToken" SET "usedAt"=now() WHERE hash=$1 AND kind='VERIFY' AND "usedAt" IS NULL AND "expiresAt">now() RETURNING "userId"`,
        [tokenHash(token)],
        db
      )
      if (!t) throw fail(400, "This verification link is invalid or expired.")
      await rq(
        `UPDATE "RentalUser" SET verified=true WHERE id=$1`,
        [t.userId],
        db
      )
    })
    res.json({ message: "Your email address is verified." })
  })
)
rentalRouter.post(
  "/reset-password",
  sensitive,
  wrap(async (req, res) => {
    const data = z.object({ token: text(100), password }).parse(req.body)
    const hash = await bcrypt.hash(data.password, 12)
    await tx(async (db) => {
      const [t] = await rq(
        `UPDATE "RentalToken" SET "usedAt"=now() WHERE hash=$1 AND kind='RESET' AND "usedAt" IS NULL AND "expiresAt">now() RETURNING "userId"`,
        [tokenHash(data.token)],
        db
      )
      if (!t) throw fail(400, "This reset link is invalid or expired.")
      await rq(
        `UPDATE "RentalUser" SET "passwordHash"=$2,"sessionVersion"="sessionVersion"+1 WHERE id=$1`,
        [t.userId, hash],
        db
      )
      await rq(
        `UPDATE "RentalToken" SET "usedAt"=now() WHERE "userId"=$1 AND kind='RESET'`,
        [t.userId],
        db
      )
    })
    res.json({ message: "Password updated. Please log in again." })
  })
)
rentalRouter.patch(
  "/profile",
  signed,
  wrap(async (req, res) => {
    const data = z
      .object({
        name: text(100),
        phone: z
          .string()
          .max(30)
          .regex(/^$|^\+[1-9][\d ()-]{7,24}$/),
        notifications: z.boolean(),
      })
      .parse(req.body)
    await tx(async (db) => {
      await rq(
        `UPDATE "RentalUser" SET name=$2 WHERE id=$1`,
        [req.rentalUser!.id, data.name],
        db
      )
      await rq(
        `INSERT INTO "RentalProfile" ("userId",phone,notifications) VALUES ($1,$2,$3) ON CONFLICT ("userId") DO UPDATE SET phone=$2,notifications=$3`,
        [req.rentalUser!.id, data.phone, data.notifications],
        db
      )
    })
    res.json(await current(req))
  })
)
rentalRouter.get(
  "/destinations",
  wrap(async (req, res) => {
    const q = z
      .string()
      .max(100)
      .parse(req.query.q || "")
    res.json(
      await rq(
        `SELECT p.city,count(*)::int AS count FROM "RentalProperty" p JOIN "RentalUser" u ON u.id=p."hostId" WHERE p.status='PUBLISHED' AND u.active AND ${rentalRegionSql()} AND p.city ILIKE $1 GROUP BY p.city ORDER BY count DESC,p.city LIMIT 10`,
        [`%${rentalDestination(q)}%`]
      )
    )
  })
)
rentalRouter.get(
  "/search",
  wrap(async (req, res) => {
    const data = z
      .object({
        destination: z.string().max(100).default(""),
        checkIn: z.string().optional(),
        checkOut: z.string().optional(),
        guests: z.coerce.number().int().min(1).max(30).default(1),
        category: z.string().max(100).default(""),
        type: z.string().max(100).default(""),
        minPrice: z.coerce.number().min(0).max(1000000).default(0),
        maxPrice: z.coerce.number().min(0).max(1000000).default(1000000),
        bedrooms: z.coerce.number().int().min(0).max(20).default(0),
        beds: z.coerce.number().int().min(0).max(30).default(0),
        bathrooms: z.coerce.number().int().min(0).max(20).default(0),
        amenities: z.string().max(500).default(""),
        rating: z.coerce.number().min(0).max(5).default(0),
        instantBook: z.enum(["true", "false"]).optional(),
        flexible: z.enum(["true", "false"]).optional(),
        sort: z
          .enum(["recommended", "price-asc", "price-desc", "rating"])
          .default("recommended"),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(req.query)
    if (Boolean(data.checkIn) !== Boolean(data.checkOut))
      throw fail(400, "Choose both check-in and checkout.")
    if (data.checkIn && data.checkOut) rentalDates(data.checkIn, data.checkOut)
    const values: unknown[] = [],
      clauses = [
        `p.status='PUBLISHED'`,
        rentalRegionSql(),
        `u.active`,
        `EXISTS (SELECT 1 FROM "RentalCategory" c WHERE c.name=p.category AND c.active)`,
      ]
    const add = (sql: string, value: unknown) => {
      values.push(value)
      clauses.push(sql.replaceAll("?", `$${values.length}`))
    }
    add(`p.city ILIKE ?`, `%${rentalDestination(data.destination)}%`)
    add(`p.capacity>=?`, data.guests)
    const guestRate = `(CASE WHEN ${data.guests}>=2 AND p.capacity>=2 THEN GREATEST(p."nightlyRate",350000) ELSE p."nightlyRate" END)`
    add(`${guestRate}>=?`, Math.round(data.minPrice * 100))
    add(`${guestRate}<=?`, Math.round(data.maxPrice * 100))
    add(`p.bedrooms>=?`, data.bedrooms)
    add(`p.beds>=?`, data.beds)
    add(`p.bathrooms>=?`, data.bathrooms)
    if (data.category) add(`p.category=?`, data.category)
    if (data.type) add(`p.type=?`, data.type)
    if (data.instantBook === "true")
      clauses.push(`p."instantBook"=true AND p."bookingMode"='PAYMENT'`)
    if (data.flexible === "true") clauses.push(`p.cancellation='FLEXIBLE'`)
    const amenities = [...new Set(data.amenities.split(",").filter(Boolean))]
    if (amenities.length) {
      values.push(amenities)
      clauses.push(
        `(SELECT count(*) FROM "RentalPropertyAmenity" a WHERE a."propertyId"=p.id AND a.amenity=ANY($${values.length}::text[]))=${amenities.length}`
      )
    }
    if (data.rating)
      add(
        `COALESCE((SELECT avg(r.rating) FROM "RentalReview" r WHERE r."propertyId"=p.id AND r.visible),0)>=?`,
        data.rating
      )
    if (data.checkIn && data.checkOut) {
      values.push(data.checkIn, data.checkOut)
      const start = `$${values.length - 1}`,
        end = `$${values.length}`
      clauses.push(
        `NOT EXISTS (SELECT 1 FROM "RentalBlockedDate" d WHERE d."propertyId"=p.id AND d.start<${end}::date AND d."end">${start}::date) AND NOT EXISTS (SELECT 1 FROM "RentalBookingNight" n JOIN "RentalBooking" b ON b.id=n."bookingId" WHERE n."propertyId"=p.id AND n.night>=${start}::date AND n.night<${end}::date AND (b.status IN ('CONFIRMED','COMPLETED') OR (b.status='PENDING' AND b."expiresAt">now())))`
      )
    }
    const where = clauses.join(" AND "),
      sort = {
        recommended: `p."createdAt" DESC`,
        "price-asc": `${guestRate} ASC`,
        "price-desc": `${guestRate} DESC`,
        rating: `rating DESC NULLS LAST`,
      }[data.sort]
    const [count] = await rq(
      `SELECT count(*)::int AS total FROM "RentalProperty" p JOIN "RentalUser" u ON u.id=p."hostId" WHERE ${where}`,
      values
    )
    const items = await rq(
      propertySelect +
        ` WHERE ${where} ORDER BY ${sort},p.id LIMIT 24 OFFSET $${values.length + 1}`,
      [...values, (data.page - 1) * 24]
    )
    res.json({ items, total: count.total, page: data.page, pageSize: 24 })
  })
)
rentalRouter.get(
  "/properties/:slug",
  wrap(async (req, res) => {
    const [p] = await rq(
      propertySelect +
        ` WHERE (p.slug=$1 OR p.id=$1) AND p.status='PUBLISHED' AND u.active AND ${rentalRegionSql()}`,
      [req.params.slug]
    )
    if (!p) throw fail(404, "This stay is not available.")
    const reviews = await rq(
      `SELECT r.id,r.rating,r.body,r.response,r."createdAt",u.name FROM "RentalReview" r JOIN "RentalUser" u ON u.id=r."userId" WHERE r."propertyId"=$1 AND r.visible ORDER BY r."createdAt" DESC LIMIT 50`,
      [p.id]
    )
    const blocked = await rq(
      `SELECT start,"end" FROM "RentalBlockedDate" WHERE "propertyId"=$1 AND "end">CURRENT_DATE UNION ALL SELECT "checkIn" AS start,"checkOut" AS "end" FROM "RentalBooking" WHERE "propertyId"=$1 AND "checkOut">CURRENT_DATE AND (status IN ('CONFIRMED','COMPLETED') OR (status='PENDING' AND "expiresAt">now()))`,
      [p.id]
    )
    res.json({ ...p, reviews, blocked })
  })
)
rentalRouter.post(
  "/properties/:id/quote",
  wrap(async (req, res) => {
    const d = dateInput.parse(req.body)
    const [p] = await rq(
      `SELECT * FROM "RentalProperty" WHERE id=$1 AND status='PUBLISHED' AND ${rentalRegionSql("")}`,
      [req.params.id]
    )
    if (!p) throw fail(404, "Stay not found.")
    if (d.guests > p.capacity)
      throw fail(400, "This stay cannot accommodate that many guests.")
    const price = await quoteRental(p, d.checkIn, d.checkOut, d.coupon, undefined, d.bookingType, d.arrivalTime, d.departureTime, d.guests)
    if (!(await rentalAvailable(p.id, d.checkIn, d.checkOut)))
      throw fail(409, "Those dates are no longer available.")
    res.json({ ...price, bookingMode: p.bookingMode })
  })
)
rentalRouter.post(
  "/bookings",
  signed,
  sensitive,
  wrap(async (req, res) => {
    const d = dateInput
      .extend({
        propertyId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
      })
      .parse(req.body)
    const booking = await tx(async (db) => {
      const [p] = await rq(
        `SELECT * FROM "RentalProperty" WHERE id=$1 AND status='PUBLISHED' AND ${rentalRegionSql("")} FOR UPDATE`,
        [d.propertyId],
        db
      )
      if (!p) throw fail(404, "Stay not found.")
      if (p.hostId === req.rentalUser!.id)
        throw fail(400, "You cannot book your own property.")
      const [existing] = await rq(
        `SELECT * FROM "RentalBooking" WHERE "idempotencyKey"=$1`,
        [d.idempotencyKey],
        db
      )
      if (existing) {
        if (
          existing.guestId !== req.rentalUser!.id ||
          existing.propertyId !== p.id ||
          new Date(existing.checkIn).toISOString().slice(0, 10) !== d.checkIn ||
          new Date(existing.checkOut).toISOString().slice(0, 10) !==
            d.checkOut ||
          existing.guests !== d.guests
          || existing.bookingType !== d.bookingType
          || (d.bookingType === "HOURLY" && (existing.arrivalTime !== d.arrivalTime || existing.departureTime !== d.departureTime))
        )
          throw fail(
            409,
            "This request key belongs to a different reservation."
          )
        return existing
      }
      if (d.guests > p.capacity)
        throw fail(400, "Too many guests for this stay.")
      if (
        p.bookingMode === "PAYMENT" &&
        (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      )
        throw fail(
          503,
          "Online payments are not configured for this stay. No booking or charge was made."
        )
      const price = await quoteRental(p, d.checkIn, d.checkOut, d.coupon, db, d.bookingType, d.arrivalTime, d.departureTime, d.guests)
      await expireRentals(db, p.id)
      if (!(await rentalAvailable(p.id, d.checkIn, d.checkOut, db)))
        throw fail(409, "Those dates are no longer available.")
      const id = rid(),
        reference = `HV-${rid().slice(0, 8).toUpperCase()}`
      const [b] = await rq(
        `INSERT INTO "RentalBooking" (id,reference,"propertyId","guestId","checkIn","checkOut",guests,"nightlySubtotal","cleaningFee","platformFee",tax,discount,total,"expiresAt","idempotencyKey","bookingMode",cancellation,"bookingType","durationHours","arrivalTime","departureTime") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()+$14::interval,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
        [
          id,
          reference,
          p.id,
          req.rentalUser!.id,
          d.checkIn,
          d.checkOut,
          d.guests,
          price.nightlySubtotal,
          price.cleaningFee,
          price.platformFee,
          price.tax,
          price.discount,
          price.total,
          p.bookingMode === "PAYMENT" ? "20 minutes" : "48 hours",
          d.idempotencyKey,
          p.bookingMode,
          p.cancellation,
          d.bookingType,
          d.bookingType === "HOURLY" ? rentalHours(d.arrivalTime, d.departureTime) : null,
          d.bookingType === "HOURLY" ? d.arrivalTime : p.checkInTime,
          d.bookingType === "HOURLY" ? d.departureTime : p.checkOutTime,
        ],
        db
      )
      await rq(
        `INSERT INTO "RentalBookingNight" ("propertyId",night,"bookingId") SELECT $1,day::date,$2 FROM generate_series($3::date,$4::date-1,interval '1 day') day`,
        [p.id, id, d.checkIn, d.checkOut],
        db
      )
      await rentalAudit(req.rentalUser!.id, "BOOKING_CREATED", id, db)
      return b
    })
    const [p] = await rq(`SELECT "hostId" FROM "RentalProperty" WHERE id=$1`, [
      booking.propertyId,
    ])
    await rentalNotify(
      p.hostId,
      `New reservation request ${booking.reference}`,
      "/host/reservations"
    )
    res.status(201).json(booking)
  })
)
const bookingSelect = `SELECT b.*,p.title,p.city,p.slug,p."hostId",u.name AS "guestName",(SELECT url FROM "RentalPropertyImage" WHERE "propertyId"=p.id ORDER BY position LIMIT 1) AS image,(SELECT id FROM "RentalReview" WHERE "bookingId"=b.id) AS "reviewId" FROM "RentalBooking" b JOIN "RentalProperty" p ON p.id=b."propertyId" JOIN "RentalUser" u ON u.id=b."guestId"`
rentalRouter.get(
  "/bookings",
  signed,
  wrap(async (req, res) => {
    await expireRentals()
    await rq(
      `UPDATE "RentalBooking" SET status='COMPLETED' WHERE status='CONFIRMED' AND "checkOut"<=CURRENT_DATE`
    )
    res.json(
      await rq(
        bookingSelect +
          ` WHERE b."guestId"=$1 ORDER BY b."createdAt" DESC LIMIT 100`,
        [req.rentalUser!.id]
      )
    )
  })
)
rentalRouter.post(
  "/bookings/:id/cancel",
  signed,
  wrap(async (req, res) => {
    const { reason } = z
      .object({ reason: z.string().trim().max(1000).default("") })
      .parse(req.body || {})
    const booking = await tx(async (db) => {
      const [initial] = await rq(
        bookingSelect + ` WHERE b.id=$1`,
        [req.params.id],
        db
      )
      if (
        !initial ||
        (![initial.guestId, initial.hostId].includes(req.rentalUser!.id) &&
          req.rentalUser!.role !== "ADMIN")
      )
        throw fail(404, "Reservation not found.")
      await rq(
        `SELECT id FROM "RentalProperty" WHERE id=$1 FOR UPDATE`,
        [initial.propertyId],
        db
      )
      const [b] = await rq(
        `SELECT * FROM "RentalBooking" WHERE id=$1 FOR UPDATE`,
        [req.params.id],
        db
      )
      if (["CANCELLED", "PAYMENT_FAILED"].includes(b.status)) return b
      if (
        b.status === "COMPLETED" ||
        (new Date(b.checkIn).getTime() <= Date.now() &&
          b.status === "CONFIRMED")
      )
        throw fail(
          409,
          "Contact support about a stay that has already started."
        )
      await rq(
        `UPDATE "RentalBooking" SET status='CANCELLED',"cancelReason"=$2 WHERE id=$1`,
        [
          b.id,
          (req.rentalUser!.id === initial.guestId
            ? "Guest cancellation"
            : "Host or administrator cancellation") +
            (reason ? `: ${reason}` : ""),
        ],
        db
      )
      await rq(
        `DELETE FROM "RentalBookingNight" WHERE "bookingId"=$1`,
        [b.id],
        db
      )
      if (b.paymentStatus === "PAID") {
        const [payment] = await rq(
          `SELECT * FROM "RentalPayment" WHERE "bookingId"=$1`,
          [b.id],
          db
        )
        const amount =
          req.rentalUser!.id === initial.guestId
            ? rentalRefundAmount(
                b.total,
                initial.cancellation,
                new Date(b.checkIn).toISOString()
              )
            : b.total
        if (amount > 0)
          await rq(
            `INSERT INTO "RentalRefund" (id,"bookingId","paymentId",amount) VALUES ($1,$2,$3,$4) ON CONFLICT ("bookingId") DO NOTHING`,
            [rid(), b.id, payment.paymentId, amount],
            db
          )
      }
      await rentalAudit(req.rentalUser!.id, "BOOKING_CANCELLED", b.id, db)
      return { ...b, status: "CANCELLED" }
    })
    res.json({
      ...booking,
      message:
        "Reservation cancelled. Any eligible refund is recorded for provider processing.",
    })
  })
)
rentalRouter.post(
  "/bookings/:id/review",
  signed,
  wrap(async (req, res) => {
    const d = z
      .object({ rating: z.number().int().min(1).max(5), body: text(3000) })
      .parse(req.body)
    const [b] = await rq(
      `SELECT * FROM "RentalBooking" WHERE id=$1 AND "guestId"=$2 AND status IN ('CONFIRMED','COMPLETED') AND "checkOut"<=CURRENT_DATE`,
      [req.params.id, req.rentalUser!.id]
    )
    if (!b)
      throw fail(
        403,
        "Reviews are available only after an eligible completed stay."
      )
    const [r] = await rq(
      `INSERT INTO "RentalReview" (id,"bookingId","propertyId","userId",rating,body) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("bookingId") DO NOTHING RETURNING *`,
      [rid(), b.id, b.propertyId, req.rentalUser!.id, d.rating, d.body]
    )
    if (!r) throw fail(409, "You have already reviewed this stay.")
    res.status(201).json(r)
  })
)
rentalRouter.get(
  "/wishlists",
  signed,
  wrap(async (req, res) => {
    const lists = await rq(
      `SELECT w.*,(SELECT COALESCE(json_agg("propertyId"),'[]') FROM "RentalWishlistItem" WHERE "wishlistId"=w.id) AS "propertyIds" FROM "RentalWishlist" w WHERE w."userId"=$1 ORDER BY w."createdAt"`,
      [req.rentalUser!.id]
    )
    const items = await rq(
      propertySelect +
        ` WHERE p.status='PUBLISHED' AND ${rentalRegionSql()} AND p.id IN (SELECT i."propertyId" FROM "RentalWishlistItem" i JOIN "RentalWishlist" w ON w.id=i."wishlistId" WHERE w."userId"=$1)`,
      [req.rentalUser!.id]
    )
    res.json({ lists, items })
  })
)
rentalRouter.post(
  "/wishlists",
  signed,
  wrap(async (req, res) => {
    const { name } = z.object({ name: text(80) }).parse(req.body)
    const [row] = await rq(
      `INSERT INTO "RentalWishlist" (id,"userId",name) VALUES ($1,$2,$3) RETURNING *`,
      [rid(), req.rentalUser!.id, name]
    )
    res.status(201).json(row)
  })
)
rentalRouter.patch(
  "/wishlists/:id",
  signed,
  wrap(async (req, res) => {
    const { name } = z.object({ name: text(80) }).parse(req.body)
    const [row] = await rq(
      `UPDATE "RentalWishlist" SET name=$3 WHERE id=$1 AND "userId"=$2 RETURNING *`,
      [req.params.id, req.rentalUser!.id, name]
    )
    if (!row) throw fail(404, "Wishlist not found.")
    res.json(row)
  })
)
rentalRouter.delete(
  "/wishlists/:id",
  signed,
  wrap(async (req, res) => {
    const rows = await rq(
      `DELETE FROM "RentalWishlist" WHERE id=$1 AND "userId"=$2 RETURNING id`,
      [req.params.id, req.rentalUser!.id]
    )
    if (!rows.length) throw fail(404, "Wishlist not found.")
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/wishlists/:id/items",
  signed,
  wrap(async (req, res) => {
    const { propertyId } = z
      .object({ propertyId: z.string().uuid() })
      .parse(req.body)
    if (
      !(
        await rq(
          `SELECT id FROM "RentalWishlist" WHERE id=$1 AND "userId"=$2`,
          [req.params.id, req.rentalUser!.id]
        )
      ).length
    )
      throw fail(404, "Wishlist not found.")
    if (
      !(
        await rq(
          `SELECT id FROM "RentalProperty" WHERE id=$1 AND status='PUBLISHED' AND ${rentalRegionSql("")}`,
          [propertyId]
        )
      ).length
    )
      throw fail(404, "Stay not found.")
    await rq(
      `INSERT INTO "RentalWishlistItem" ("wishlistId","propertyId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.id, propertyId]
    )
    res.json({ ok: true })
  })
)
rentalRouter.delete(
  "/wishlists/:id/items/:propertyId",
  signed,
  wrap(async (req, res) => {
    await rq(
      `DELETE FROM "RentalWishlistItem" i USING "RentalWishlist" w WHERE i."wishlistId"=w.id AND w.id=$1 AND w."userId"=$2 AND i."propertyId"=$3`,
      [req.params.id, req.rentalUser!.id, req.params.propertyId]
    )
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/conversations",
  signed,
  messagesLimit,
  wrap(async (req, res) => {
    const { propertyId, body } = z
      .object({ propertyId: z.string().uuid(), body: text(3000) })
      .parse(req.body)
    const [p] = await rq(
      `SELECT * FROM "RentalProperty" WHERE id=$1 AND status='PUBLISHED' AND ${rentalRegionSql("")}`,
      [propertyId]
    )
    if (!p || p.hostId === req.rentalUser!.id)
      throw fail(400, "Choose another host's stay to start a conversation.")
    const [thread] = await rq(
      `INSERT INTO "RentalConversation" (id,"propertyId","guestId","hostId") VALUES ($1,$2,$3,$4) ON CONFLICT ("propertyId","guestId") DO UPDATE SET "propertyId"=EXCLUDED."propertyId" RETURNING *`,
      [rid(), p.id, req.rentalUser!.id, p.hostId]
    )
    await rq(
      `INSERT INTO "RentalMessage" (id,"conversationId","senderId",body) VALUES ($1,$2,$3,$4)`,
      [rid(), thread.id, req.rentalUser!.id, body]
    )
    await rentalNotify(p.hostId, "You have a new guest message.", "/messages")
    res.status(201).json(thread)
  })
)
rentalRouter.get(
  "/conversations",
  signed,
  wrap(async (req, res) => {
    res.json(
      await rq(
        `SELECT c.*,p.title,(SELECT body FROM "RentalMessage" WHERE "conversationId"=c.id ORDER BY "createdAt" DESC LIMIT 1) AS preview,(SELECT count(*)::int FROM "RentalMessage" WHERE "conversationId"=c.id AND "senderId"<>$1 AND "readAt" IS NULL) AS unread FROM "RentalConversation" c JOIN "RentalProperty" p ON p.id=c."propertyId" WHERE c."guestId"=$1 OR c."hostId"=$1 ORDER BY c."createdAt" DESC LIMIT 100`,
        [req.rentalUser!.id]
      )
    )
  })
)
async function ownedThread(req: Request) {
  const [c] = await rq(
    `SELECT * FROM "RentalConversation" WHERE id=$1 AND ("guestId"=$2 OR "hostId"=$2)`,
    [req.params.id, req.rentalUser!.id]
  )
  if (!c) throw fail(404, "Conversation not found.")
  return c
}
rentalRouter.get(
  "/conversations/:id",
  signed,
  wrap(async (req, res) => {
    await ownedThread(req)
    await rq(
      `UPDATE "RentalMessage" SET "readAt"=now() WHERE "conversationId"=$1 AND "senderId"<>$2 AND "readAt" IS NULL`,
      [req.params.id, req.rentalUser!.id]
    )
    res.json(
      await rq(
        `SELECT m.id,m.body,m."senderId",m."createdAt",u.name FROM "RentalMessage" m JOIN "RentalUser" u ON u.id=m."senderId" WHERE m."conversationId"=$1 ORDER BY m."createdAt" LIMIT 300`,
        [req.params.id]
      )
    )
  })
)
rentalRouter.post(
  "/conversations/:id",
  signed,
  messagesLimit,
  wrap(async (req, res) => {
    const { body } = z.object({ body: text(3000) }).parse(req.body)
    const c = await ownedThread(req)
    await rq(
      `INSERT INTO "RentalMessage" (id,"conversationId","senderId",body) VALUES ($1,$2,$3,$4)`,
      [rid(), c.id, req.rentalUser!.id, body]
    )
    await rentalNotify(
      c.guestId === req.rentalUser!.id ? c.hostId : c.guestId,
      "You have a new message.",
      "/messages"
    )
    res.status(201).json({ ok: true })
  })
)
rentalRouter.get(
  "/notifications",
  signed,
  wrap(async (req, res) => {
    res.json(
      await rq(
        `SELECT * FROM "RentalNotification" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 50`,
        [req.rentalUser!.id]
      )
    )
  })
)
rentalRouter.post(
  "/notifications/read",
  signed,
  wrap(async (req, res) => {
    await rq(
      `UPDATE "RentalNotification" SET "readAt"=now() WHERE "userId"=$1 AND "readAt" IS NULL`,
      [req.rentalUser!.id]
    )
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/reports",
  signed,
  messagesLimit,
  wrap(async (req, res) => {
    const d = z
      .object({ targetId: text(150), body: text(3000) })
      .parse(req.body)
    await rq(
      `INSERT INTO "RentalReport" (id,"userId","targetId",body) VALUES ($1,$2,$3,$4)`,
      [rid(), req.rentalUser!.id, d.targetId, d.body]
    )
    res
      .status(201)
      .json({ message: "Your report has been saved for platform review." })
  })
)
// Host ownership and approval are checked on the server, never from submitted roles.
rentalRouter.post(
  "/host/onboard",
  signed,
  wrap(async (req, res) => {
    const { bio } = z.object({ bio: text(3000) }).parse(req.body)
    await rq(
      `INSERT INTO "RentalHost" ("userId",bio) VALUES ($1,$2) ON CONFLICT ("userId") DO UPDATE SET bio=$2`,
      [req.rentalUser!.id, bio]
    )
    res.json({
      message: "Your hosting application is saved for administrator approval.",
    })
  })
)
rentalRouter.get(
  "/host/status",
  signed,
  wrap(async (req, res) => {
    const [host] = await rq(`SELECT * FROM "RentalHost" WHERE "userId"=$1`, [
      req.rentalUser!.id,
    ])
    res.json(host || { status: "NOT_APPLIED" })
  })
)
rentalRouter.use("/host", signed)
async function ownedProperty(req: Request, db?: Parameters<typeof rq>[2]) {
  const [p] = await rq(
    `SELECT * FROM "RentalProperty" WHERE id=$1 AND ("hostId"=$2 OR $3='ADMIN')`,
    [req.params.id, req.rentalUser!.id, req.rentalUser!.role],
    db
  )
  if (!p) throw fail(404, "Listing not found.")
  return p
}
rentalRouter.get(
  "/host/listings",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    res.json(
      await rq(
        propertySelect + ` WHERE p."hostId"=$1 ORDER BY p."createdAt" DESC`,
        [req.rentalUser!.id]
      )
    )
  })
)
rentalRouter.get(
  "/host/listings/:id",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    await ownedProperty(req)
    const [p] = await rq(propertySelect + ` WHERE p.id=$1`, [req.params.id])
    res.json(p)
  })
)
rentalRouter.post(
  "/host/listings",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    const d = propertySchema.parse(req.body)
    if (
      !(
        await rq(`SELECT name FROM "RentalCategory" WHERE name=$1 AND active`, [
          d.category,
        ])
      ).length
    )
      throw fail(400, "Choose an active property category.")
    const { amenities, ...fields } = d
    const id = rid()
    await tx(async (db) => {
      const keys = Object.keys(fields)
      await rq(
        `INSERT INTO "RentalProperty" (id,"hostId",${keys.map((k) => `"${k}"`).join(",")}) VALUES ($1,$2,${keys.map((_, i) => `$${i + 3}`).join(",")})`,
        [id, req.rentalUser!.id, ...Object.values(fields)],
        db
      )
      for (const a of amenities)
        await rq(
          `INSERT INTO "RentalPropertyAmenity" ("propertyId",amenity) VALUES ($1,$2)`,
          [id, a],
          db
        )
      await rentalAudit(req.rentalUser!.id, "LISTING_CREATED", id, db)
    })
    res.status(201).json({ id })
  })
)
rentalRouter.patch(
  "/host/listings/:id",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    const d = parsePatch(propertySchema, req.body)
    if (
      d.category &&
      !(
        await rq(`SELECT name FROM "RentalCategory" WHERE name=$1 AND active`, [
          d.category,
        ])
      ).length
    )
      throw fail(400, "Choose an active property category.")
    const { amenities, ...fields } = d
    await tx(async (db) => {
      await ownedProperty(req, db)
      const keys = Object.keys(fields)
      if (keys.length)
        await rq(
          `UPDATE "RentalProperty" SET ${keys.map((k, i) => `"${k}"=$${i + 2}`).join(",")},status='DRAFT',"approvedAt"=NULL,"updatedAt"=now() WHERE id=$1`,
          [req.params.id, ...Object.values(fields)],
          db
        )
      if (amenities) {
        await rq(
          `UPDATE "RentalProperty" SET status='DRAFT',"approvedAt"=NULL,"updatedAt"=now() WHERE id=$1`,
          [req.params.id],
          db
        )
        await rq(
          `DELETE FROM "RentalPropertyAmenity" WHERE "propertyId"=$1`,
          [req.params.id],
          db
        )
        for (const a of amenities)
          await rq(
            `INSERT INTO "RentalPropertyAmenity" ("propertyId",amenity) VALUES ($1,$2)`,
            [req.params.id, a],
            db
          )
      }
      await rentalAudit(
        req.rentalUser!.id,
        "LISTING_EDITED",
        String(req.params.id),
        db
      )
    })
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/host/listings/:id/publish",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    const p = await ownedProperty(req)
    const { publish } = z.object({ publish: z.boolean() }).parse(req.body)
    if (publish && !rentalCity(p.city))
      throw fail(400, "Only stays in Delhi NCR can be published.")
    const [images] = await rq(
      `SELECT count(*)::int AS count FROM "RentalPropertyImage" WHERE "propertyId"=$1`,
      [p.id]
    )
    if (publish && !images.count)
      throw fail(400, "Upload at least one property photo first.")
    const status = publish ? (p.approvedAt ? "PUBLISHED" : "PENDING") : "DRAFT"
    await rq(`UPDATE "RentalProperty" SET status=$2 WHERE id=$1`, [
      p.id,
      status,
    ])
    res.json({ status })
  })
)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
})
rentalRouter.post(
  "/host/listings/:id/photos",
  role("HOST", "ADMIN"),
  imageUpload.single("image"),
  wrap(async (req, res) => {
    const p = await ownedProperty(req)
    if (!req.file) throw fail(400, "Choose a photo to upload.")
    const [count] = await rq(
      `SELECT count(*)::int AS count FROM "RentalPropertyImage" WHERE "propertyId"=$1`,
      [p.id]
    )
    if (count.count >= 20) throw fail(400, "Use at most 20 photos.")
    const file = await saveFile(req.file, true, `Property photo for ${p.title}`)
    const id = rid()
    await rq(
      `INSERT INTO "RentalPropertyImage" (id,"propertyId",url,position) VALUES ($1,$2,$3,$4)`,
      [id, p.id, `/media/${file.id}`, count.count]
    )
    res.status(201).json({ id, url: `/media/${file.id}` })
  })
)
rentalRouter.get(
  "/host/listings/:id/photos",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    await ownedProperty(req)
    res.json(
      await rq(
        `SELECT * FROM "RentalPropertyImage" WHERE "propertyId"=$1 ORDER BY position`,
        [req.params.id]
      )
    )
  })
)
rentalRouter.patch(
  "/host/listings/:id/photos",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    const { ids } = z
      .object({ ids: z.array(z.string().uuid()).max(20) })
      .parse(req.body)
    await tx(async (db) => {
      await ownedProperty(req, db)
      for (const [position, id] of ids.entries())
        await rq(
          `UPDATE "RentalPropertyImage" SET position=$3 WHERE id=$1 AND "propertyId"=$2`,
          [id, req.params.id, position],
          db
        )
    })
    res.json({ ok: true })
  })
)
rentalRouter.delete(
  "/host/listings/:id/photos/:photoId",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    await ownedProperty(req)
    const [row] = await rq(
      `DELETE FROM "RentalPropertyImage" WHERE id=$1 AND "propertyId"=$2 RETURNING id`,
      [req.params.photoId, req.params.id]
    )
    if (!row) throw fail(404, "Photo not found.")
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/profile/photo",
  signed,
  imageUpload.single("image"),
  wrap(async (req, res) => {
    if (!req.file) throw fail(400, "Choose a profile image.")
    const asset = await saveFile(req.file, true, "Profile photo")
    await rq(`UPDATE "RentalProfile" SET photo=$2 WHERE "userId"=$1`, [
      req.rentalUser!.id,
      `/media/${asset.id}`,
    ])
    res.json({ photo: `/media/${asset.id}` })
  })
)
rentalRouter.get(
  "/host/calendar",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    res.json(
      await rq(
        `SELECT d.*,p.title FROM "RentalBlockedDate" d JOIN "RentalProperty" p ON p.id=d."propertyId" WHERE p."hostId"=$1 ORDER BY d.start`,
        [req.rentalUser!.id]
      )
    )
  })
)
rentalRouter.post(
  "/host/listings/:id/blocks",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    const d = z
      .object({
        start: z.string(),
        end: z.string(),
        reason: z.string().max(200).default(""),
      })
      .parse(req.body)
    rentalDates(d.start, d.end)
    await tx(async (db) => {
      await ownedProperty(req, db)
      await rq(
        `SELECT id FROM "RentalProperty" WHERE id=$1 FOR UPDATE`,
        [req.params.id],
        db
      )
      if (!(await rentalAvailable(String(req.params.id), d.start, d.end, db)))
        throw fail(409, "These dates contain an existing reservation or block.")
      await rq(
        `INSERT INTO "RentalBlockedDate" (id,"propertyId",start,"end",reason) VALUES ($1,$2,$3,$4,$5)`,
        [rid(), req.params.id, d.start, d.end, d.reason],
        db
      )
    })
    res.status(201).json({ ok: true })
  })
)
rentalRouter.delete(
  "/host/blocks/:id",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    await rq(
      `DELETE FROM "RentalBlockedDate" d USING "RentalProperty" p WHERE d."propertyId"=p.id AND d.id=$1 AND p."hostId"=$2`,
      [req.params.id, req.rentalUser!.id]
    )
    res.json({ ok: true })
  })
)
rentalRouter.get(
  "/host/reservations",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    await expireRentals()
    res.json(
      await rq(
        bookingSelect +
          ` WHERE p."hostId"=$1 ORDER BY b."createdAt" DESC LIMIT 100`,
        [req.rentalUser!.id]
      )
    )
  })
)
rentalRouter.post(
  "/host/reservations/:id/accept",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    const b = await tx(async (db) => {
      const [b] = await rq(
        bookingSelect + ` WHERE b.id=$1 AND p."hostId"=$2`,
        [req.params.id, req.rentalUser!.id],
        db
      )
      if (!b) throw fail(404, "Reservation not found.")
      await rq(
        `SELECT id FROM "RentalProperty" WHERE id=$1 FOR UPDATE`,
        [b.propertyId],
        db
      )
      await expireRentals(db, b.propertyId)
      const [fresh] = await rq(
        `SELECT * FROM "RentalBooking" WHERE id=$1 FOR UPDATE`,
        [b.id],
        db
      )
      if (fresh.status === "CONFIRMED") return fresh
      if (
        fresh.status !== "PENDING" ||
        b.bookingMode !== "HOST_APPROVAL" ||
        new Date(fresh.expiresAt).getTime() <= Date.now()
      )
        throw fail(409, "This request cannot be accepted.")
      await rq(
        `UPDATE "RentalBooking" SET status='CONFIRMED',"expiresAt"=NULL,"paymentStatus"='PAY_AT_PROPERTY' WHERE id=$1`,
        [b.id],
        db
      )
      await rentalAudit(req.rentalUser!.id, "HOST_CONFIRMED", b.id, db)
      return b
    })
    await rentalNotify(
      b.guestId,
      `Your stay ${b.reference} is confirmed. Payment is due at the property.`,
      "/trips"
    )
    res.json({ status: "CONFIRMED" })
  })
)
rentalRouter.get(
  "/host/earnings",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    res.json(
      await rq(
        `SELECT b.reference,p.title,b.status,b."paymentStatus",b.total,b."platformFee",b."createdAt",COALESCE(r.amount,0) AS refund FROM "RentalBooking" b JOIN "RentalProperty" p ON p.id=b."propertyId" LEFT JOIN "RentalRefund" r ON r."bookingId"=b.id WHERE p."hostId"=$1 ORDER BY b."createdAt" DESC LIMIT 200`,
        [req.rentalUser!.id]
      )
    )
  })
)
rentalRouter.get(
  "/host/reviews",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    res.json(
      await rq(
        `SELECT r.id,r.rating,r.body,r.response,r."createdAt",p.title,u.name FROM "RentalReview" r JOIN "RentalProperty" p ON p.id=r."propertyId" JOIN "RentalUser" u ON u.id=r."userId" WHERE p."hostId"=$1 AND r.visible ORDER BY r."createdAt" DESC LIMIT 100`,
        [req.rentalUser!.id]
      )
    )
  })
)
rentalRouter.patch(
  "/host/reviews/:id",
  role("HOST", "ADMIN"),
  wrap(async (req, res) => {
    const { response } = z.object({ response: text(3000) }).parse(req.body)
    const [row] = await rq(
      `UPDATE "RentalReview" r SET response=$3 FROM "RentalProperty" p WHERE p.id=r."propertyId" AND p."hostId"=$1 AND r.id=$2 RETURNING r.id`,
      [req.rentalUser!.id, req.params.id, response]
    )
    if (!row) throw fail(404, "Review not found.")
    res.json({ ok: true })
  })
)
// Payment orders and captured transactions always originate from the provider.
rentalRouter.post(
  "/bookings/:id/pay",
  signed,
  wrap(async (req, res) => {
    const result = await tx(async (db) => {
      await rq(
        `SELECT id FROM "RentalBooking" WHERE id=$1 AND "guestId"=$2 FOR UPDATE`,
        [req.params.id, req.rentalUser!.id],
        db
      )
      const [b] = await rq(
        bookingSelect + ` WHERE b.id=$1 AND b."guestId"=$2`,
        [req.params.id, req.rentalUser!.id],
        db
      )
      if (
        !b ||
        b.status !== "PENDING" ||
        new Date(b.expiresAt).getTime() <= Date.now() ||
        b.bookingMode !== "PAYMENT"
      )
        throw fail(409, "This reservation cannot start a payment.")
      let [p] = await rq(
        `SELECT * FROM "RentalPayment" WHERE "bookingId"=$1`,
        [b.id],
        db
      )
      if (!p) {
        const order = await razorpay("orders", "POST", {
          amount: b.total,
          currency: "INR",
          receipt: b.reference,
          notes: { bookingId: b.id },
        })
        if (!order.id || order.amount !== b.total || order.currency !== "INR")
          throw fail(
            502,
            "The payment provider returned an invalid order. No payment was started."
          )
        ;[p] = await rq(
          `INSERT INTO "RentalPayment" (id,"bookingId","orderId",amount) VALUES ($1,$2,$3,$4) ON CONFLICT ("bookingId") DO UPDATE SET "bookingId"=EXCLUDED."bookingId" RETURNING *`,
          [rid(), b.id, order.id, b.total],
          db
        )
      }
      return {
        orderId: p.orderId,
        amount: p.amount,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID,
        bookingId: b.id,
      }
    })
    res.json(result)
  })
)
export async function settleRentalPayment(orderId: string, paymentId: string) {
  const payment = await razorpay(`payments/${encodeURIComponent(paymentId)}`)
  if (
    payment.status !== "captured" ||
    payment.order_id !== orderId ||
    payment.currency !== "INR"
  )
    throw fail(
      409,
      "Payment is not yet captured. Your reservation is not confirmed."
    )
  const result = await tx(async (db) => {
    const [p] = await rq(
      `SELECT * FROM "RentalPayment" WHERE "orderId"=$1`,
      [orderId],
      db
    )
    if (!p || p.amount !== payment.amount)
      throw fail(409, "The provider amount does not match this reservation.")
    const [initial] = await rq(
      `SELECT * FROM "RentalBooking" WHERE id=$1`,
      [p.bookingId],
      db
    )
    await rq(
      `SELECT id FROM "RentalProperty" WHERE id=$1 FOR UPDATE`,
      [initial.propertyId],
      db
    )
    const [b] = await rq(
      `SELECT * FROM "RentalBooking" WHERE id=$1 FOR UPDATE`,
      [p.bookingId],
      db
    )
    if (p.status === "CAPTURED") return b
    await rq(
      `UPDATE "RentalPayment" SET "paymentId"=$2,status='CAPTURED' WHERE id=$1`,
      [p.id, paymentId],
      db
    )
    if (
      b.status !== "PENDING" ||
      new Date(b.expiresAt).getTime() <= Date.now()
    ) {
      await rq(
        `UPDATE "RentalBooking" SET status='CANCELLED',"paymentStatus"='REFUND_PENDING' WHERE id=$1`,
        [b.id],
        db
      )
      await rq(
        `DELETE FROM "RentalBookingNight" WHERE "bookingId"=$1`,
        [b.id],
        db
      )
      await rq(
        `INSERT INTO "RentalRefund" (id,"bookingId","paymentId",amount) VALUES ($1,$2,$3,$4) ON CONFLICT ("bookingId") DO NOTHING`,
        [rid(), b.id, paymentId, b.total],
        db
      )
      return { ...b, status: "CANCELLED" }
    }
    await rq(
      `UPDATE "RentalBooking" SET status='CONFIRMED',"paymentStatus"='PAID',"expiresAt"=NULL WHERE id=$1`,
      [b.id],
      db
    )
    return { ...b, status: "CONFIRMED" }
  })
  await rentalNotify(
    result.guestId,
    result.status === "CONFIRMED"
      ? `Payment verified. Reservation ${result.reference} is confirmed.`
      : `Payment arrived after reservation expiry. A full refund is recorded for ${result.reference}.`,
    "/trips"
  )
  return result
}
rentalRouter.post(
  "/bookings/:id/verify",
  signed,
  wrap(async (req, res) => {
    const d = z
      .object({
        paymentId: text(100),
        orderId: text(100),
        signature: text(100),
      })
      .parse(req.body)
    const [p] = await rq(
      `SELECT p.* FROM "RentalPayment" p JOIN "RentalBooking" b ON b.id=p."bookingId" WHERE b.id=$1 AND b."guestId"=$2`,
      [req.params.id, req.rentalUser!.id]
    )
    if (
      !p ||
      p.orderId !== d.orderId ||
      !verifyRentalSignature(
        `${p.orderId}|${d.paymentId}`,
        d.signature,
        process.env.RAZORPAY_KEY_SECRET || ""
      )
    )
      throw fail(400, "Payment verification failed.")
    res.json(await settleRentalPayment(p.orderId, d.paymentId))
  })
)
rentalRouter.post(
  "/bookings/:id/payment-failed",
  signed,
  wrap(async (req, res) => {
    const [booking] = await rq(
      `SELECT id FROM "RentalBooking" WHERE id=$1 AND "guestId"=$2`,
      [req.params.id, req.rentalUser!.id]
    )
    if (!booking) throw fail(404, "Reservation not found.")
    // A failed browser attempt is not an authoritative order failure. The same
    // checkout can retry, and a captured webhook may still be on its way.
    res.json({
      message:
        "The attempt failed. You can retry before your reservation hold expires.",
    })
  })
)
rentalRouter.use("/admin", signed, role("ADMIN"))
rentalRouter.get(
  "/admin/overview",
  wrap(async (_req, res) => {
    const [counts] = await rq(
      `SELECT (SELECT count(*)::int FROM "RentalUser") AS users,(SELECT count(*)::int FROM "RentalProperty") AS listings,(SELECT count(*)::int FROM "RentalBooking") AS bookings,(SELECT COALESCE(sum(amount),0)::bigint FROM "RentalPayment" WHERE status='CAPTURED') AS paid,(SELECT count(*)::int FROM "RentalHost" WHERE status='PENDING') AS "pendingHosts",(SELECT count(*)::int FROM "RentalProperty" WHERE status='PENDING') AS "pendingListings"`
    )
    res.json(counts)
  })
)
rentalRouter.get(
  "/admin/:entity",
  wrap(async (req, res) => {
    const entity = String(req.params.entity)
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(req.query.page || 1)
    const search = z
      .string()
      .max(200)
      .parse(req.query.search || "")
    const tables: Record<
      string,
      { table: string; fields: string; search: string; order?: string }
    > = {
      users: {
        table: '"RentalUser"',
        fields: 'id,name,email,role,verified,active,"createdAt"',
        search: "name",
        order: '"createdAt" DESC,id',
      },
      hosts: { table: '"RentalHost"', fields: "*", search: "bio" },
      listings: { table: '"RentalProperty"', fields: "*", search: "title" },
      bookings: { table: '"RentalBooking"', fields: "*", search: "reference" },
      payments: { table: '"RentalPayment"', fields: "*", search: "status" },
      refunds: { table: '"RentalRefund"', fields: "*", search: "status" },
      reviews: { table: '"RentalReview"', fields: "*", search: "body" },
      reports: { table: '"RentalReport"', fields: "*", search: "body" },
      categories: {
        table: '"RentalCategory"',
        fields: "*",
        search: "name",
        order: "name",
      },
      coupons: {
        table: '"RentalCoupon"',
        fields: "*",
        search: "code",
        order: "code",
      },
      settings: {
        table: '"RentalSetting"',
        fields: "*",
        search: "key",
        order: "key",
      },
      audit: { table: '"RentalAudit"', fields: "*", search: "action" },
    }
    const t = tables[entity]
    if (!t) throw fail(404, "Admin section not found.")
    const where =
      entity === "users"
        ? ` WHERE (name ILIKE $1 OR email ILIKE $1)`
        : ` WHERE "${t.search}" ILIKE $1`
    const [count] = await rq(
      `SELECT count(*)::int AS total FROM ${t.table}${where}`,
      [`%${search}%`]
    )
    const items = await rq(
      `SELECT ${t.fields} FROM ${t.table}${where} ORDER BY ${t.order || '"createdAt" DESC,' + (entity === "hosts" ? '"userId"' : "id")} LIMIT 30 OFFSET $2`,
      [`%${search}%`, (page - 1) * 30]
    )
    res.json({ items, total: count.total, page, pageSize: 30 })
  })
)
rentalRouter.post(
  "/admin/bookings/:id/confirm",
  wrap(async (req, res) => {
    const booking = await tx(async (db) => {
      const [initial] = await rq(
        `SELECT * FROM "RentalBooking" WHERE id=$1`,
        [req.params.id],
        db
      )
      if (!initial) throw fail(404, "Reservation not found.")
      await rq(
        `SELECT id FROM "RentalProperty" WHERE id=$1 FOR UPDATE`,
        [initial.propertyId],
        db
      )
      await expireRentals(db, initial.propertyId)
      const [currentBooking] = await rq(
        `SELECT * FROM "RentalBooking" WHERE id=$1 FOR UPDATE`,
        [initial.id],
        db
      )
      if (!currentBooking || currentBooking.status !== "PENDING")
        throw fail(409, "Only a pending reservation can be confirmed.")
      if (
        !currentBooking.expiresAt ||
        new Date(currentBooking.expiresAt).getTime() <= Date.now()
      )
        throw fail(409, "This reservation hold has expired.")
      const [captured] = await rq(
        `SELECT id FROM "RentalPayment" WHERE "bookingId"=$1 AND status='CAPTURED'`,
        [currentBooking.id],
        db
      )
      if (captured)
        throw fail(
          409,
          "A captured payment needs reconciliation before this reservation can be confirmed manually."
        )
      await rq(
        `UPDATE "RentalBooking" SET status='CONFIRMED',"paymentStatus"='PAY_AT_PROPERTY',"expiresAt"=NULL WHERE id=$1`,
        [currentBooking.id],
        db
      )
      await rentalAudit(
        req.rentalUser!.id,
        "ADMIN_CONFIRMED",
        currentBooking.id,
        db
      )
      return currentBooking
    })
    await rentalNotify(
      booking.guestId,
      `Your stay ${booking.reference} is confirmed by the administrator. Payment is due at the property.`,
      "/trips"
    )
    res.json({ status: "CONFIRMED", paymentStatus: "PAY_AT_PROPERTY" })
  })
)
rentalRouter.patch(
  "/admin/users/:id",
  wrap(async (req, res) => {
    const d = z
      .object({
        active: z.boolean().optional(),
        role: z.enum(["GUEST", "HOST", "ADMIN"]).optional(),
      })
      .parse(req.body)
    if (
      req.params.id === req.rentalUser!.id &&
      (d.active === false || (d.role && d.role !== "ADMIN"))
    )
      throw fail(
        400,
        "You cannot disable or demote your own administrator account."
      )
    await tx(async (db) => {
      const [updated] = await rq(
        `UPDATE "RentalUser" SET active=COALESCE($2,active),role=COALESCE($3,role),"sessionVersion"="sessionVersion"+1 WHERE id=$1 RETURNING id`,
        [req.params.id, d.active ?? null, d.role ?? null],
        db
      )
      if (!updated) throw fail(404, "User not found.")
      await rentalAudit(
        req.rentalUser!.id,
        "USER_UPDATED",
        String(req.params.id),
        db
      )
    })
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/admin/hosts/:id/decision",
  wrap(async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body)
    await tx(async (db) => {
      const [h] = await rq(
        `UPDATE "RentalHost" SET status=$2 WHERE "userId"=$1 RETURNING *`,
        [req.params.id, approved ? "APPROVED" : "REJECTED"],
        db
      )
      if (!h) throw fail(404, "Hosting application not found.")
      if (!approved)
        await rq(
          `UPDATE "RentalProperty" SET status='DRAFT',"approvedAt"=NULL WHERE "hostId"=$1`,
          [req.params.id],
          db
        )
      await rq(
        `UPDATE "RentalUser" SET role=$2 WHERE id=$1 AND role<>'ADMIN'`,
        [req.params.id, approved ? "HOST" : "GUEST"],
        db
      )
      await rentalAudit(
        req.rentalUser!.id,
        "HOST_DECISION",
        String(req.params.id),
        db
      )
    })
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/admin/listings/:id/decision",
  wrap(async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body)
    await tx(async (db) => {
      const [listing] = await rq(
        `SELECT city FROM "RentalProperty" WHERE id=$1 FOR UPDATE`,
        [req.params.id],
        db
      )
      if (approved && listing && !rentalCity(listing.city))
        throw fail(400, "Only stays in Delhi NCR can be approved.")
      const [p] = await rq(
        `UPDATE "RentalProperty" SET status=$2,"approvedAt"=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1 RETURNING *`,
        [req.params.id, approved ? "PUBLISHED" : "REJECTED", approved],
        db
      )
      if (!p) throw fail(404, "Listing not found.")
      await rentalAudit(req.rentalUser!.id, "LISTING_MODERATED", p.id, db)
    })
    res.json({ ok: true })
  })
)
rentalRouter.patch(
  "/admin/reviews/:id",
  wrap(async (req, res) => {
    const { visible } = z.object({ visible: z.boolean() }).parse(req.body)
    await tx(async (db) => {
      const [updated] = await rq(
        `UPDATE "RentalReview" SET visible=$2 WHERE id=$1 RETURNING id`,
        [req.params.id, visible],
        db
      )
      if (!updated) throw fail(404, "Review not found.")
      await rentalAudit(
        req.rentalUser!.id,
        "REVIEW_MODERATED",
        String(req.params.id),
        db
      )
    })
    res.json({ ok: true })
  })
)
rentalRouter.patch(
  "/admin/reports/:id",
  wrap(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]) })
      .parse(req.body)
    await tx(async (db) => {
      const [updated] = await rq(
        `UPDATE "RentalReport" SET status=$2 WHERE id=$1 RETURNING id`,
        [req.params.id, status],
        db
      )
      if (!updated) throw fail(404, "Report not found.")
      await rentalAudit(
        req.rentalUser!.id,
        "REPORT_UPDATED",
        String(req.params.id),
        db
      )
    })
    res.json({ ok: true })
  })
)
rentalRouter.patch(
  "/admin/settings",
  wrap(async (req, res) => {
    const d = z
      .object({
        platformFeeBps: z.coerce.number().int().min(0).max(3000),
        taxBps: z.coerce.number().int().min(0).max(4000),
        banner: z.string().max(300),
      })
      .parse(req.body)
    await tx(async (db) => {
      for (const [key, value] of Object.entries(d))
        await rq(
          `INSERT INTO "RentalSetting" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2`,
          [key, String(value)],
          db
        )
      await rentalAudit(req.rentalUser!.id, "SETTINGS_UPDATED", "platform", db)
    })
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/admin/categories",
  wrap(async (req, res) => {
    const { name } = z.object({ name: text(100) }).parse(req.body)
    await tx(async (db) => {
      await rq(
        `INSERT INTO "RentalCategory" (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [name],
        db
      )
      await rentalAudit(req.rentalUser!.id, "CATEGORY_CREATED", name, db)
    })
    res.status(201).json({ ok: true })
  })
)
rentalRouter.patch(
  "/admin/categories/:name",
  wrap(async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body)
    await tx(async (db) => {
      const [updated] = await rq(
        `UPDATE "RentalCategory" SET active=$2 WHERE name=$1 RETURNING name`,
        [req.params.name, active],
        db
      )
      if (!updated) throw fail(404, "Category not found.")
      await rentalAudit(
        req.rentalUser!.id,
        "CATEGORY_UPDATED",
        String(req.params.name),
        db
      )
    })
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/admin/coupons",
  wrap(async (req, res) => {
    const d = z
      .object({
        code: text(40).regex(/^[A-Z0-9]+$/),
        percent: z.coerce.number().int().min(1).max(50),
        expiresAt: z.string().datetime(),
      })
      .parse(req.body)
    await tx(async (db) => {
      await rq(
        `INSERT INTO "RentalCoupon" (code,percent,"expiresAt") VALUES ($1,$2,$3) ON CONFLICT (code) DO UPDATE SET percent=$2,"expiresAt"=$3,active=true`,
        [d.code, d.percent, d.expiresAt],
        db
      )
      await rentalAudit(req.rentalUser!.id, "COUPON_SAVED", d.code, db)
    })
    res.status(201).json({ ok: true })
  })
)
rentalRouter.patch(
  "/admin/coupons/:code",
  wrap(async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body)
    await tx(async (db) => {
      const [updated] = await rq(
        `UPDATE "RentalCoupon" SET active=$2 WHERE code=$1 RETURNING code`,
        [req.params.code, active],
        db
      )
      if (!updated) throw fail(404, "Coupon not found.")
      await rentalAudit(
        req.rentalUser!.id,
        "COUPON_UPDATED",
        String(req.params.code),
        db
      )
    })
    res.json({ ok: true })
  })
)
rentalRouter.post(
  "/admin/refunds/:id/process",
  wrap(async (req, res) => {
    const refund = await tx(async (db) => {
      const [r] = await rq(
        `SELECT * FROM "RentalRefund" WHERE id=$1 FOR UPDATE`,
        [req.params.id],
        db
      )
      if (!r) throw fail(404, "Refund not found.")
      if (r.status !== "PENDING")
        throw fail(
          409,
          "This refund is already processed or requires provider reconciliation."
        )
      await rq(
        `UPDATE "RentalRefund" SET status='PROCESSING' WHERE id=$1`,
        [r.id],
        db
      )
      return r
    })
    try {
      const result = await razorpay(
        `payments/${encodeURIComponent(refund.paymentId)}/refund`,
        "POST",
        {
          amount: refund.amount,
          notes: { refundId: refund.id, bookingId: refund.bookingId },
        }
      )
      await rq(
        `UPDATE "RentalRefund" SET status=$2,"providerId"=$3 WHERE id=$1`,
        [
          refund.id,
          result.status === "processed" ? "PROCESSED" : "PROCESSING",
          result.id,
        ]
      )
      await rq(`UPDATE "RentalBooking" SET "paymentStatus"=$2 WHERE id=$1`, [
        refund.bookingId,
        result.status === "processed" ? "REFUNDED" : "REFUND_PROCESSING",
      ])
      res.json({ status: result.status })
    } catch (error) {
      await rq(
        `UPDATE "RentalRefund" SET status='RECONCILE_REQUIRED' WHERE id=$1`,
        [refund.id]
      )
      throw error
    }
  })
)
rentalRouter.get(
  "/config",
  wrap(async (_req, res) => {
    const settings = await rq(`SELECT key,value FROM "RentalSetting"`)
    res.json({
      settings: Object.fromEntries(settings.map((x) => [x.key, x.value])),
      categories: (
        await rq(`SELECT name FROM "RentalCategory" WHERE active`)
      ).map((x) => x.name),
    })
  })
)
// Exported separately so the provider receives the untouched request body before JSON parsing and browser-origin checks.
export function rentalWebhook(req: Request, res: Response, next: NextFunction) {
  Promise.resolve()
    .then(async () => {
      const signature = String(req.headers["x-razorpay-signature"] || "")
      if (
        !Buffer.isBuffer(req.body) ||
        !verifyRentalSignature(
          req.body,
          signature,
          process.env.RAZORPAY_WEBHOOK_SECRET || ""
        )
      )
        throw fail(400, "Invalid webhook signature.")
      let event
      try {
        event = JSON.parse(req.body.toString("utf8"))
      } catch {
        throw fail(400, "Malformed webhook payload.")
      }
      const eventId = String(
        req.headers["x-razorpay-event-id"] ||
          createHash("sha256").update(req.body).digest("hex")
      )
      if (
        (await rq(`SELECT id FROM "RentalPaymentEvent" WHERE id=$1`, [eventId]))
          .length
      )
        return res.json({ ok: true })
      if (event.event === "payment.captured") {
        const p = event.payload?.payment?.entity
        if (!p?.id || !p.order_id) throw fail(400, "Malformed payment event.")
        await settleRentalPayment(p.order_id, p.id)
      } else if (event.event === "refund.processed") {
        const r = event.payload?.refund?.entity
        if (r?.id)
          await tx(async (db) => {
            const rows = await rq(
              `UPDATE "RentalRefund" SET status='PROCESSED' WHERE "providerId"=$1 RETURNING "bookingId"`,
              [r.id],
              db
            )
            for (const row of rows)
              await rq(
                `UPDATE "RentalBooking" SET "paymentStatus"='REFUNDED' WHERE id=$1`,
                [row.bookingId],
                db
              )
          })
      }
      await rq(
        `INSERT INTO "RentalPaymentEvent" (id,kind) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [eventId, String(event.event)]
      )
      res.json({ ok: true })
    })
    .catch(next)
}
