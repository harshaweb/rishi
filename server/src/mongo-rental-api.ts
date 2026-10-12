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
import { saveFile } from "./storage.js"
import { parsePatch } from "./validation.js"
import { dateInput, propertySchema } from "./rental-input.js"
import { rentalDestination, rentalCity } from "../shared/rental-region.js"
import { rentalFail as fail } from "./rental-errors.js"
import {
  rentalDates,
  rentalEmail,
  rentalRefundAmount,
  razorpay,
  verifyRentalSignature,
} from "./rental-utils.js"
import {
  collection as c,
  record,
  clean,
  rid,
  options,
  initializeRentals,
  transaction as tx,
  lockProperty,
  expire,
  expireAll,
  available,
  quote,
  audit,
  notify,
  properties,
  searchProperties,
  destinations,
  bookingRows,
  activeBookingFilter,
} from "./mongo-rental-store.js"
import type { ClientSession, Document } from "mongodb"

// Session/request declarations are shared with the legacy router during migration.
import type {} from "./rental-api.js"
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
const text = (max = 1000) => z.string().trim().min(1).max(max)
const password = z.string().min(12).max(72)
const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase())
const param = (req: Request, key = "id") => String(req.params[key])
const uid = (req: Request) => req.rentalUser!.id
const tokenHash = (s: string) => createHash("sha256").update(s).digest("hex")
async function current(req: Request) {
  if (!req.session.rentalUserId) return null
  const u = await c("User").findOne({
    id: req.session.rentalUserId,
    active: true,
    sessionVersion: req.session.rentalVersion,
  })
  if (!u) return null
  const p = await c("Profile").findOne({ userId: u.id })
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    verified: u.verified,
    sessionVersion: u.sessionVersion,
    phone: p?.phone || "",
    photo: p?.photo || "",
    notifications: p?.notifications ?? true,
  }
}
const signed = (req: Request, _res: Response, next: NextFunction) => {
  current(req)
    .then((u) => {
      if (!u) throw fail(401, "Please log in to continue.")
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
const sensitive = rateLimit({
  windowMs: 15 * 60000,
  limit: 25,
  store: rateStore("mongo-rental-auth:"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
})
const messagesLimit = rateLimit({
  windowMs: 60000,
  limit: 20,
  store: rateStore("mongo-rental-message:"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
})
export const mongoRentalRouter = express.Router()
const r = mongoRentalRouter
r.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  initializeRentals()
    .then(() => next())
    .catch(next)
})
r.use((req, _res, next) => {
  if (
    !["GET", "HEAD"].includes(req.method) &&
    (!req.session.csrf || req.headers["x-csrf-token"] !== req.session.csrf)
  )
    return next(fail(403, "Refresh the page to renew your security token."))
  next()
})
async function issueToken(userId: string, address: string, kind: string) {
  const token = randomBytes(32).toString("base64url")
  await c("Token").insertOne(
    record({
      userId,
      hash: tokenHash(token),
      kind,
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
    })
  )
  const link = `${process.env.SITE_URL || "http://localhost:5173"}/${kind === "VERIFY" ? "verify-email" : "reset-password"}?token=${token}`
  const emailStatus = await rentalEmail(
    address,
    kind === "VERIFY"
      ? "Verify your Omshivraj email"
      : "Reset your Omshivraj password",
    `Use this link within one hour: ${link}`
  )
  return {
    emailStatus,
    ...(process.env.NODE_ENV !== "production" ? { developmentLink: link } : {}),
  }
}
r.get(
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
r.post(
  "/signup",
  sensitive,
  wrap(async (req, res) => {
    const d = z
      .object({ name: text(100), email, password, consent: z.literal(true) })
      .parse(req.body)
    const id = rid(),
      passwordHash = await bcrypt.hash(d.password, 12)
    await tx(async (session) => {
      if (await c("User").findOne({ email: d.email }, options(session)))
        throw fail(409, "This email is already registered.")
      await c("User").insertOne(
        record(
          {
            name: d.name,
            email: d.email,
            passwordHash,
            role: "GUEST",
            verified: false,
            active: true,
            sessionVersion: 0,
          },
          id
        ),
        options(session)
      )
      await c("Profile").insertOne(
        record({ userId: id, phone: "", photo: "", notifications: true }, id),
        options(session)
      )
    })
    res
      .status(201)
      .json({
        message:
          "Your account was created. Verify your email before requesting a stay.",
        ...(await issueToken(id, d.email, "VERIFY")),
      })
  })
)
r.post(
  "/login",
  sensitive,
  wrap(async (req, res) => {
    const d = z.object({ email, password: z.string().max(72) }).parse(req.body)
    const u = await c("User").findOne({ email: d.email })
    const ok = await bcrypt.compare(
      d.password,
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
r.post(
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
r.post(
  "/forgot-password",
  sensitive,
  wrap(async (req, res) => {
    const d = z.object({ email }).parse(req.body)
    const u = await c("User").findOne({ email: d.email, active: true })
    res.json({
      message:
        "If an account exists, password reset instructions have been requested.",
      ...(u ? await issueToken(u.id!, d.email, "RESET") : {}),
    })
  })
)
r.post(
  "/resend-verification",
  sensitive,
  signed,
  wrap(async (req, res) =>
    res.json(await issueToken(uid(req), req.rentalUser!.email, "VERIFY"))
  )
)
for (const kind of ["VERIFY", "RESET"])
  r.post(
    kind === "VERIFY" ? "/verify-email" : "/reset-password",
    sensitive,
    wrap(async (req, res) => {
      const d = z
        .object({ token: text(100), ...(kind === "RESET" ? { password } : {}) })
        .parse(req.body)
      const hash =
        kind === "RESET" ? await bcrypt.hash(String(d.password), 12) : undefined
      await tx(async (session) => {
        const t = await c("Token").findOneAndUpdate(
          {
            hash: tokenHash(d.token),
            kind,
            usedAt: null,
            expiresAt: { $gt: new Date() },
          },
          { $set: { usedAt: new Date() } },
          { ...options(session), returnDocument: "after" }
        )
        if (!t) throw fail(400, "This link is invalid or expired.")
        await c("User").updateOne(
          { id: t.userId },
          kind === "VERIFY"
            ? { $set: { verified: true } }
            : { $set: { passwordHash: hash }, $inc: { sessionVersion: 1 } },
          options(session)
        )
        if (kind === "RESET")
          await c("Token").updateMany(
            { userId: t.userId, kind },
            { $set: { usedAt: new Date() } },
            options(session)
          )
      })
      res.json({
        message:
          kind === "VERIFY"
            ? "Email verified. You can now request stays."
            : "Password updated. Please log in again.",
      })
    })
  )
r.patch(
  "/profile",
  signed,
  wrap(async (req, res) => {
    const d = z
      .object({
        name: text(100),
        phone: z
          .string()
          .max(30)
          .regex(/^$|^\+[1-9][\d ()-]{7,24}$/),
        notifications: z.boolean(),
      })
      .parse(req.body)
    await tx(async (session) => {
      await c("User").updateOne(
        { id: uid(req) },
        { $set: { name: d.name } },
        options(session)
      )
      await c("Profile").updateOne(
        { userId: uid(req) },
        {
          $set: { phone: d.phone, notifications: d.notifications },
          $setOnInsert: { _id: uid(req), userId: uid(req), photo: "" },
        },
        { ...options(session), upsert: true }
      )
    })
    res.json(await current(req))
  })
)
r.get(
  "/destinations",
  wrap(async (req, res) => {
    const q = rentalDestination(
      z
        .string()
        .max(100)
        .parse(req.query.q || "")
    ).toLowerCase()
    res.json(await destinations(q))
  })
)
r.get(
  "/search",
  wrap(async (req, res) => {
    const d = z
      .object({
        destination: z.string().max(100).default(""),
        checkIn: z.string().default(""),
        checkOut: z.string().default(""),
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
        instantBook: z.enum(["true", "false"]).default("false"),
        flexible: z.enum(["true", "false"]).default("false"),
        sort: z
          .enum(["recommended", "price-asc", "price-desc", "rating"])
          .default("recommended"),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(req.query)
    if (Boolean(d.checkIn) !== Boolean(d.checkOut))
      throw fail(400, "Choose both arrival and departure dates.")
    if (d.checkIn) rentalDates(d.checkIn, d.checkOut)
    const destination = rentalDestination(d.destination).toLowerCase()
    const destinationPattern = destination.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    )
    res.json(
      await searchProperties(
        {
          city: { $regex: destinationPattern, $options: "i" },
          capacity: { $gte: d.guests },
          nightlyRate: {
            $gte: Math.round(d.minPrice * 100),
            $lte: Math.round(d.maxPrice * 100),
          },
          bedrooms: { $gte: d.bedrooms },
          beds: { $gte: d.beds },
          bathrooms: { $gte: d.bathrooms },
          ...(d.category ? { category: d.category } : {}),
          ...(d.type ? { type: d.type } : {}),
          ...(d.instantBook === "true"
            ? { instantBook: true, bookingMode: "PAYMENT" }
            : {}),
          ...(d.flexible === "true" ? { cancellation: "FLEXIBLE" } : {}),
        },
        d
      )
    )
  })
)
async function publicProperty(id: string, session?: ClientSession) {
  const p = (
    await properties({ $or: [{ id }, { slug: id }] }, session, true, 1)
  )[0]
  if (!p) throw fail(404, "This stay is not available.")
  return p
}
r.get(
  "/properties/:slug",
  wrap(async (req, res) => {
    const p = await publicProperty(param(req, "slug"))
    const reviews = await c("Review")
      .aggregate([
        { $match: { propertyId: p.id, visible: true } },
        { $sort: { createdAt: -1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: "RentalUser",
            localField: "userId",
            foreignField: "id",
            as: "author",
          },
        },
        { $set: { name: { $arrayElemAt: ["$author.name", 0] } } },
        { $project: { author: 0, _id: 0 } },
      ])
      .toArray()
    const today = new Date().toISOString().slice(0, 10)
    const blocks = await c("BlockedDate")
      .find(
        { propertyId: p.id, end: { $gt: today } },
        { projection: { _id: 0, start: 1, end: 1 } }
      )
      .toArray()
    const bookings = await c("Booking")
      .find(
        {
          propertyId: p.id,
          checkOut: { $gt: today },
          ...activeBookingFilter(),
        },
        { projection: { checkIn: 1, checkOut: 1 } }
      )
      .toArray()
    res.json({
      ...p,
      reviews,
      blocked: [
        ...blocks,
        ...bookings.map((b) => ({ start: b.checkIn, end: b.checkOut })),
      ],
    })
  })
)
r.post(
  "/properties/:id/quote",
  wrap(async (req, res) => {
    const d = dateInput.parse(req.body)
    const p = await publicProperty(param(req))
    if (d.guests > p.capacity) throw fail(400, "Too many guests for this stay.")
    const price = await quote(p, d.checkIn, d.checkOut, d.coupon)
    if (!(await available(p.id, d.checkIn, d.checkOut)))
      throw fail(409, "Those dates are no longer available.")
    res.json({ ...price, bookingMode: p.bookingMode })
  })
)
r.post(
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
    if (!req.rentalUser!.verified)
      throw fail(403, "Verify your email before requesting a stay.")
    const result = await tx(async (session) => {
      await lockProperty(d.propertyId, session)
      const p = await publicProperty(d.propertyId, session)
      if (p.hostId === uid(req))
        throw fail(400, "You cannot book your own property.")
      const existing = await c("Booking").findOne(
        { idempotencyKey: d.idempotencyKey },
        options(session)
      )
      if (existing) {
        if (
          existing.guestId !== uid(req) ||
          existing.propertyId !== p.id ||
          existing.checkIn !== d.checkIn ||
          existing.checkOut !== d.checkOut ||
          existing.guests !== d.guests
        )
          throw fail(
            409,
            "This request key belongs to a different reservation."
          )
        return { booking: existing, created: false, hostId: p.hostId }
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
      const price = await quote(p, d.checkIn, d.checkOut, d.coupon, session)
      await expire(p.id, session)
      if (!(await available(p.id, d.checkIn, d.checkOut, session)))
        throw fail(409, "Those dates are no longer available.")
      const booking = record({
        ...price,
        propertyId: p.id,
        guestId: uid(req),
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        guests: d.guests,
        idempotencyKey: d.idempotencyKey,
        reference: `HV-${rid().slice(0, 8).toUpperCase()}`,
        bookingMode: p.bookingMode,
        cancellation: p.cancellation,
        status: "PENDING",
        paymentStatus: "UNPAID",
        cancelReason: "",
        expiresAt: new Date(
          Date.now() + (p.bookingMode === "PAYMENT" ? 20 * 60000 : 48 * 3600000)
        ),
      })
      await c("Booking").insertOne(booking, options(session))
      for (let i = 0; i < price.nights; i++) {
        const night = new Date(Date.parse(d.checkIn) + i * 86400000)
          .toISOString()
          .slice(0, 10)
        await c("BookingNight").insertOne(
          record(
            { propertyId: p.id, bookingId: booking.id, night },
            `${p.id}:${night}`
          ),
          options(session)
        )
      }
      await audit(uid(req), "BOOKING_CREATED", booking.id!, session)
      return { booking, created: true, hostId: p.hostId }
    })
    if (result.created)
      await notify(
        result.hostId,
        `New reservation request ${result.booking.reference}`,
        "/host/reservations"
      )
    res.status(201).json(clean(result.booking))
  })
)
r.get(
  "/bookings",
  signed,
  wrap(async (req, res) => {
    await expireAll()
    res.json(await bookingRows({ guestId: uid(req) }))
  })
)
r.post(
  "/bookings/:id/cancel",
  signed,
  wrap(async (req, res) => {
    const { reason } = z
      .object({ reason: z.string().trim().max(1000).default("") })
      .parse(req.body || {})
    const booking = await tx(async (session) => {
      const initial = await c("Booking").findOne(
        { id: param(req) },
        options(session)
      )
      if (!initial) throw fail(404, "Reservation not found.")
      const p = await lockProperty(initial.propertyId, session)
      if (
        ![initial.guestId, p.hostId].includes(uid(req)) &&
        req.rentalUser!.role !== "ADMIN"
      )
        throw fail(404, "Reservation not found.")
      const b = (await c("Booking").findOne(
        { id: initial.id },
        options(session)
      ))!
      if (["CANCELLED", "PAYMENT_FAILED"].includes(b.status)) return b
      if (
        b.status === "COMPLETED" ||
        (b.status === "CONFIRMED" && Date.parse(b.checkIn) <= Date.now())
      )
        throw fail(
          409,
          "Contact support about a stay that has already started."
        )
      await c("Booking").updateOne(
        { id: b.id },
        { $set: { status: "CANCELLED", cancelReason: reason } },
        options(session)
      )
      await c("BookingNight").deleteMany({ bookingId: b.id }, options(session))
      if (b.paymentStatus === "PAID") {
        const payment = await c("Payment").findOne(
          { bookingId: b.id },
          options(session)
        )
        const amount =
          uid(req) === b.guestId
            ? rentalRefundAmount(b.total, b.cancellation, b.checkIn)
            : b.total
        if (amount > 0 && payment) {
          await c("Refund").updateOne(
            { bookingId: b.id },
            {
              $setOnInsert: record({
                bookingId: b.id,
                paymentId: payment.paymentId,
                amount,
                status: "PENDING",
              }),
            },
            { ...options(session), upsert: true }
          )
          await c("Booking").updateOne(
            { id: b.id },
            { $set: { paymentStatus: "REFUND_PENDING" } },
            options(session)
          )
        }
      }
      await audit(uid(req), "BOOKING_CANCELLED", b.id!, session)
      return { ...b, status: "CANCELLED" }
    })
    res.json({
      ...clean(booking),
      message:
        "Reservation cancelled. Any eligible refund is recorded for provider processing.",
    })
  })
)
r.post(
  "/bookings/:id/review",
  signed,
  wrap(async (req, res) => {
    const d = z
      .object({ rating: z.number().int().min(1).max(5), body: text(3000) })
      .parse(req.body)
    const b = await c("Booking").findOne({
      id: param(req),
      guestId: uid(req),
      status: { $in: ["CONFIRMED", "COMPLETED"] },
      checkOut: { $lte: new Date().toISOString().slice(0, 10) },
    })
    if (!b)
      throw fail(
        403,
        "Reviews are available only after an eligible completed stay."
      )
    const row = record({
      ...d,
      bookingId: b.id,
      propertyId: b.propertyId,
      userId: uid(req),
      visible: true,
      response: "",
    })
    await c("Review").insertOne(row)
    res.status(201).json(clean(row))
  })
)

r.get(
  "/wishlists",
  signed,
  wrap(async (req, res) => {
    const lists = await c("Wishlist")
      .find({ userId: uid(req) })
      .sort({ createdAt: 1 })
      .toArray()
    const allIds: string[] = []
    const result = []
    for (const list of lists) {
      const ids = await c("WishlistItem").distinct("propertyId", {
        wishlistId: list.id,
      })
      allIds.push(...ids)
      result.push({ ...clean(list), propertyIds: ids })
    }
    res.json({
      lists: result,
      items: await properties({ id: { $in: allIds } }, undefined, true),
    })
  })
)
r.post(
  "/wishlists",
  signed,
  wrap(async (req, res) => {
    const d = z.object({ name: text(80) }).parse(req.body)
    const row = record({ ...d, userId: uid(req) })
    await c("Wishlist").insertOne(row)
    res.status(201).json(clean(row))
  })
)
async function ownedList(req: Request, session?: ClientSession) {
  const list = await c("Wishlist").findOne(
    { id: param(req), userId: uid(req) },
    options(session)
  )
  if (!list) throw fail(404, "Wishlist not found.")
  return list
}
r.patch(
  "/wishlists/:id",
  signed,
  wrap(async (req, res) => {
    const d = z.object({ name: text(80) }).parse(req.body)
    await ownedList(req)
    const row = await c("Wishlist").findOneAndUpdate(
      { id: param(req), userId: uid(req) },
      { $set: d },
      { returnDocument: "after" }
    )
    res.json(clean(row))
  })
)
r.delete(
  "/wishlists/:id",
  signed,
  wrap(async (req, res) => {
    await tx(async (session) => {
      await ownedList(req, session)
      await c("Wishlist").deleteOne({ id: param(req) }, options(session))
      await c("WishlistItem").deleteMany(
        { wishlistId: param(req) },
        options(session)
      )
    })
    res.json({ ok: true })
  })
)
r.post(
  "/wishlists/:id/items",
  signed,
  wrap(async (req, res) => {
    const d = z.object({ propertyId: z.string().uuid() }).parse(req.body)
    await ownedList(req)
    await publicProperty(d.propertyId)
    await c("WishlistItem").updateOne(
      { wishlistId: param(req), propertyId: d.propertyId },
      {
        $setOnInsert: record(
          { wishlistId: param(req), propertyId: d.propertyId },
          `${param(req)}:${d.propertyId}`
        ),
      },
      { upsert: true }
    )
    res.json({ ok: true })
  })
)
r.delete(
  "/wishlists/:id/items/:propertyId",
  signed,
  wrap(async (req, res) => {
    await ownedList(req)
    await c("WishlistItem").deleteOne({
      wishlistId: param(req),
      propertyId: param(req, "propertyId"),
    })
    res.json({ ok: true })
  })
)
async function ownedThread(req: Request) {
  const thread = await c("Conversation").findOne({
    id: param(req),
    $or: [{ guestId: uid(req) }, { hostId: uid(req) }],
  })
  if (!thread) throw fail(404, "Conversation not found.")
  return thread
}
r.post(
  "/conversations",
  signed,
  messagesLimit,
  wrap(async (req, res) => {
    const d = z
      .object({ propertyId: z.string().uuid(), body: text(3000) })
      .parse(req.body)
    const p = await publicProperty(d.propertyId)
    if (p.hostId === uid(req))
      throw fail(400, "Choose another host's stay to start a conversation.")
    const thread = await c("Conversation").findOneAndUpdate(
      { propertyId: p.id, guestId: uid(req) },
      {
        $setOnInsert: record({
          propertyId: p.id,
          guestId: uid(req),
          hostId: p.hostId,
        }),
      },
      { upsert: true, returnDocument: "after" }
    )
    await c("Message").insertOne(
      record({
        conversationId: thread!.id,
        senderId: uid(req),
        body: d.body,
        readAt: null,
      })
    )
    await notify(p.hostId, "You have a new guest message.", "/messages")
    res.status(201).json(clean(thread))
  })
)
r.get(
  "/conversations",
  signed,
  wrap(async (req, res) => {
    const threads = await c("Conversation")
      .find({ $or: [{ guestId: uid(req) }, { hostId: uid(req) }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    const result = []
    for (const t of threads) {
      const p = await c("Property").findOne({ id: t.propertyId })
      const last = await c("Message").findOne(
        { conversationId: t.id },
        { sort: { createdAt: -1 } }
      )
      const unread = await c("Message").countDocuments({
        conversationId: t.id,
        senderId: { $ne: uid(req) },
        readAt: null,
      })
      result.push({
        ...clean(t),
        title: p?.title,
        preview: last?.body || "",
        unread,
      })
    }
    res.json(result)
  })
)
r.get(
  "/conversations/:id",
  signed,
  wrap(async (req, res) => {
    await ownedThread(req)
    await c("Message").updateMany(
      { conversationId: param(req), senderId: { $ne: uid(req) }, readAt: null },
      { $set: { readAt: new Date() } }
    )
    res.json(
      await c("Message")
        .aggregate([
          { $match: { conversationId: param(req) } },
          { $sort: { createdAt: 1 } },
          { $limit: 300 },
          {
            $lookup: {
              from: "RentalUser",
              localField: "senderId",
              foreignField: "id",
              as: "author",
            },
          },
          { $set: { name: { $arrayElemAt: ["$author.name", 0] } } },
          { $project: { author: 0, _id: 0 } },
        ])
        .toArray()
    )
  })
)
r.post(
  "/conversations/:id",
  signed,
  messagesLimit,
  wrap(async (req, res) => {
    const d = z.object({ body: text(3000) }).parse(req.body)
    const t = await ownedThread(req)
    await c("Message").insertOne(
      record({
        conversationId: t.id,
        senderId: uid(req),
        body: d.body,
        readAt: null,
      })
    )
    await notify(
      uid(req) === t.guestId ? t.hostId : t.guestId,
      "You have a new message.",
      "/messages"
    )
    res.status(201).json({ ok: true })
  })
)
r.get(
  "/notifications",
  signed,
  wrap(async (req, res) =>
    res.json(
      (
        await c("Notification")
          .find({ userId: uid(req) })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
      ).map(clean)
    )
  )
)
r.post(
  "/notifications/read",
  signed,
  wrap(async (req, res) => {
    await c("Notification").updateMany(
      { userId: uid(req), readAt: null },
      { $set: { readAt: new Date() } }
    )
    res.json({ ok: true })
  })
)
r.post(
  "/reports",
  signed,
  messagesLimit,
  wrap(async (req, res) => {
    const d = z
      .object({ targetId: text(150), body: text(3000) })
      .parse(req.body)
    await c("Report").insertOne(
      record({ ...d, userId: uid(req), status: "OPEN" })
    )
    res
      .status(201)
      .json({ message: "Your report has been saved for platform review." })
  })
)

r.post(
  "/host/onboard",
  signed,
  wrap(async (req, res) => {
    const d = z.object({ bio: text(3000) }).parse(req.body)
    await c("Host").updateOne(
      { userId: uid(req) },
      {
        $set: d,
        $setOnInsert: {
          _id: uid(req),
          userId: uid(req),
          status: "PENDING",
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
    res.json({
      message: "Your hosting application is saved for administrator approval.",
    })
  })
)
r.get(
  "/host/status",
  signed,
  wrap(async (req, res) =>
    res.json(
      clean(await c("Host").findOne({ userId: uid(req) })) || {
        status: "NOT_APPLIED",
      }
    )
  )
)
r.use("/host", signed, role("HOST", "ADMIN"))
async function ownedProperty(
  req: Request,
  session?: ClientSession,
  id = param(req)
) {
  const p = await c("Property").findOne(
    { id, ...(req.rentalUser!.role === "ADMIN" ? {} : { hostId: uid(req) }) },
    options(session)
  )
  if (!p) throw fail(404, "Listing not found.")
  return p
}
async function validCategory(category: string, session?: ClientSession) {
  if (
    !(await c("Category").findOne(
      { name: category, active: true },
      options(session)
    ))
  )
    throw fail(400, "Choose an active property category.")
}
r.get(
  "/host/listings",
  wrap(async (req, res) => res.json(await properties({ hostId: uid(req) })))
)
r.get(
  "/host/listings/:id",
  wrap(async (req, res) => {
    await ownedProperty(req)
    res.json((await properties({ id: param(req) }))[0])
  })
)
r.post(
  "/host/listings",
  wrap(async (req, res) => {
    const d = propertySchema.parse(req.body)
    await validCategory(d.category)
    const { amenities, ...fields } = d
    const id = rid()
    await tx(async (session) => {
      await c("Property").insertOne(
        record(
          {
            ...fields,
            hostId: uid(req),
            status: "DRAFT",
            demo: false,
            approvedAt: null,
            updatedAt: new Date(),
          },
          id
        ),
        options(session)
      )
      for (const amenity of new Set(amenities))
        await c("PropertyAmenity").insertOne(
          record({ propertyId: id, amenity }, `${id}:${amenity}`),
          options(session)
        )
      await audit(uid(req), "LISTING_CREATED", id, session)
    })
    res.status(201).json({ id })
  })
)
r.patch(
  "/host/listings/:id",
  wrap(async (req, res) => {
    const d = parsePatch(propertySchema, req.body)
    const { amenities, ...fields } = d
    await tx(async (session) => {
      await lockProperty(param(req), session)
      await ownedProperty(req, session)
      if (d.category) await validCategory(d.category, session)
      await c("Property").updateOne(
        { id: param(req) },
        {
          $set: {
            ...fields,
            status: "DRAFT",
            approvedAt: null,
            updatedAt: new Date(),
          },
        },
        options(session)
      )
      if (amenities) {
        await c("PropertyAmenity").deleteMany(
          { propertyId: param(req) },
          options(session)
        )
        for (const amenity of new Set(amenities))
          await c("PropertyAmenity").insertOne(
            record(
              { propertyId: param(req), amenity },
              `${param(req)}:${amenity}`
            ),
            options(session)
          )
      }
      await audit(uid(req), "LISTING_EDITED", param(req), session)
    })
    res.json({ ok: true })
  })
)
r.post(
  "/host/listings/:id/publish",
  wrap(async (req, res) => {
    const { publish } = z.object({ publish: z.boolean() }).parse(req.body)
    const status = await tx(async (session) => {
      await lockProperty(param(req), session)
      const p = await ownedProperty(req, session)
      if (publish) {
        if (!rentalCity(p.city))
          throw fail(400, "Only stays in Delhi NCR can be published.")
        if (
          !(await c("PropertyImage").countDocuments(
            { propertyId: p.id },
            options(session)
          ))
        )
          throw fail(400, "Upload at least one property photo first.")
        await validCategory(p.category, session)
      }
      const status = publish
        ? p.approvedAt
          ? "PUBLISHED"
          : "PENDING"
        : "DRAFT"
      await c("Property").updateOne(
        { id: p.id },
        { $set: { status } },
        options(session)
      )
      return status
    })
    res.json({ status })
  })
)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
})
r.post(
  "/host/listings/:id/photos",
  imageUpload.single("image"),
  wrap(async (req, res) => {
    const p = await ownedProperty(req)
    if (!req.file) throw fail(400, "Choose a photo to upload.")
    const asset = await saveFile(
      req.file,
      true,
      `Property photo for ${p.title}`
    )
    const row = await tx(async (session) => {
      await lockProperty(p.id!, session)
      await ownedProperty(req, session)
      const count = await c("PropertyImage").countDocuments(
        { propertyId: p.id },
        options(session)
      )
      if (count >= 20) throw fail(400, "Use at most 20 photos.")
      const row = record({
        propertyId: p.id,
        url: `/media/${asset.id}`,
        position: count,
      })
      await c("PropertyImage").insertOne(row, options(session))
      return row
    })
    res.status(201).json(clean(row))
  })
)
r.get(
  "/host/listings/:id/photos",
  wrap(async (req, res) => {
    await ownedProperty(req)
    res.json(
      (
        await c("PropertyImage")
          .find({ propertyId: param(req) })
          .sort({ position: 1 })
          .toArray()
      ).map(clean)
    )
  })
)
r.patch(
  "/host/listings/:id/photos",
  wrap(async (req, res) => {
    const { ids } = z
      .object({ ids: z.array(z.string().uuid()).max(20) })
      .parse(req.body)
    if (new Set(ids).size !== ids.length)
      throw fail(400, "Duplicate photo IDs.")
    await tx(async (session) => {
      await lockProperty(param(req), session)
      await ownedProperty(req, session)
      const rows = await c("PropertyImage")
        .find({ propertyId: param(req) }, options(session))
        .toArray()
      if (
        rows.length !== ids.length ||
        !rows.every((row) => ids.includes(row.id!))
      )
        throw fail(400, "Include every photo belonging to this listing.")
      for (const [position, id] of ids.entries())
        await c("PropertyImage").updateOne(
          { id, propertyId: param(req) },
          { $set: { position } },
          options(session)
        )
    })
    res.json({ ok: true })
  })
)
r.delete(
  "/host/listings/:id/photos/:photoId",
  wrap(async (req, res) => {
    await tx(async (session) => {
      await lockProperty(param(req), session)
      await ownedProperty(req, session)
      const result = await c("PropertyImage").deleteOne(
        { id: param(req, "photoId"), propertyId: param(req) },
        options(session)
      )
      if (!result.deletedCount) throw fail(404, "Photo not found.")
      if (
        !(await c("PropertyImage").countDocuments(
          { propertyId: param(req) },
          options(session)
        ))
      )
        await c("Property").updateOne(
          { id: param(req) },
          { $set: { status: "DRAFT", approvedAt: null } },
          options(session)
        )
    })
    res.json({ ok: true })
  })
)
r.post(
  "/profile/photo",
  signed,
  imageUpload.single("image"),
  wrap(async (req, res) => {
    if (!req.file) throw fail(400, "Choose a profile image.")
    const asset = await saveFile(req.file, true, "Profile photo")
    await c("Profile").updateOne(
      { userId: uid(req) },
      {
        $set: { photo: `/media/${asset.id}` },
        $setOnInsert: { _id: uid(req), userId: uid(req), notifications: true },
      },
      { upsert: true }
    )
    res.json({ photo: `/media/${asset.id}` })
  })
)
r.get(
  "/host/calendar",
  wrap(async (req, res) => {
    const ps = await c("Property")
      .find({ hostId: uid(req) })
      .toArray()
    const rows = await c("BlockedDate")
      .find({ propertyId: { $in: ps.map((p) => p.id) } })
      .sort({ start: 1 })
      .toArray()
    res.json(
      rows.map((row) => ({
        ...clean(row),
        title: ps.find((p) => p.id === row.propertyId)?.title,
      }))
    )
  })
)
r.post(
  "/host/listings/:id/blocks",
  wrap(async (req, res) => {
    const d = z
      .object({
        start: z.string(),
        end: z.string(),
        reason: z.string().max(200).default(""),
      })
      .parse(req.body)
    rentalDates(d.start, d.end)
    await tx(async (session) => {
      await lockProperty(param(req), session)
      await ownedProperty(req, session)
      await expire(param(req), session)
      if (!(await available(param(req), d.start, d.end, session)))
        throw fail(409, "These dates contain an existing reservation or block.")
      await c("BlockedDate").insertOne(
        record({ ...d, propertyId: param(req) }),
        options(session)
      )
    })
    res.status(201).json({ ok: true })
  })
)
r.delete(
  "/host/blocks/:id",
  wrap(async (req, res) => {
    await tx(async (session) => {
      const b = await c("BlockedDate").findOne(
        { id: param(req) },
        options(session)
      )
      if (!b) throw fail(404, "Block not found.")
      await lockProperty(b.propertyId, session)
      await ownedProperty(req, session, b.propertyId)
      await c("BlockedDate").deleteOne({ id: param(req) }, options(session))
    })
    res.json({ ok: true })
  })
)
async function ownBookings(req: Request) {
  const ids = await c("Property").distinct("id", { hostId: uid(req) })
  return bookingRows({ propertyId: { $in: ids } })
}
r.get(
  "/host/reservations",
  wrap(async (req, res) => {
    await expireAll()
    res.json(await ownBookings(req))
  })
)
r.post(
  "/host/reservations/:id/accept",
  wrap(async (req, res) => {
    const booking = await tx(async (session) => {
      const initial = await c("Booking").findOne(
        { id: param(req) },
        options(session)
      )
      if (!initial) throw fail(404, "Reservation not found.")
      const p = await lockProperty(initial.propertyId, session)
      if (p.hostId !== uid(req)) throw fail(404, "Reservation not found.")
      await expire(p.id!, session)
      const b = (await c("Booking").findOne(
        { id: initial.id },
        options(session)
      ))!
      if (b.status === "CONFIRMED") return b
      if (
        b.status !== "PENDING" ||
        b.bookingMode !== "HOST_APPROVAL" ||
        new Date(b.expiresAt).getTime() <= Date.now()
      )
        throw fail(409, "This request cannot be accepted.")
      await c("Booking").updateOne(
        { id: b.id },
        {
          $set: {
            status: "CONFIRMED",
            paymentStatus: "PAY_AT_PROPERTY",
            expiresAt: null,
          },
        },
        options(session)
      )
      await audit(uid(req), "HOST_CONFIRMED", b.id!, session)
      return b
    })
    await notify(
      booking.guestId,
      `Your stay ${booking.reference} is confirmed. Payment is due at the property.`,
      "/trips"
    )
    res.json({ status: "CONFIRMED" })
  })
)
r.get(
  "/host/earnings",
  wrap(async (req, res) => res.json(await ownBookings(req)))
)
r.get(
  "/host/reviews",
  wrap(async (req, res) => {
    const ps = await c("Property")
      .find({ hostId: uid(req) })
      .toArray()
    const rows = await c("Review")
      .find({ propertyId: { $in: ps.map((p) => p.id) }, visible: true })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    const result = []
    for (const row of rows) {
      const u = await c("User").findOne({ id: row.userId })
      result.push({
        ...clean(row),
        title: ps.find((p) => p.id === row.propertyId)?.title,
        name: u?.name,
      })
    }
    res.json(result)
  })
)
r.patch(
  "/host/reviews/:id",
  wrap(async (req, res) => {
    const d = z.object({ response: text(3000) }).parse(req.body)
    const review = await c("Review").findOne({ id: param(req) })
    if (
      !review ||
      !(await c("Property").findOne({
        id: review.propertyId,
        hostId: uid(req),
      }))
    )
      throw fail(404, "Review not found.")
    await c("Review").updateOne({ id: review.id }, { $set: d })
    res.json({ ok: true })
  })
)

// Provider calls run outside retryable MongoDB transactions.
r.post(
  "/bookings/:id/pay",
  signed,
  wrap(async (req, res) => {
    const b = await c("Booking").findOne({
      id: param(req),
      guestId: uid(req),
      status: "PENDING",
      bookingMode: "PAYMENT",
      expiresAt: { $gt: new Date() },
    })
    if (!b) throw fail(409, "This reservation cannot start a payment.")
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      throw fail(
        503,
        "Online payments are not configured. No charge has been made."
      )
    let payment = await c("Payment").findOne({ bookingId: b.id })
    if (!payment) {
      const row = record({
        bookingId: b.id,
        amount: b.total,
        status: "CREATING",
      })
      try {
        await c("Payment").insertOne(row)
        payment = row
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error
        payment = await c("Payment").findOne({ bookingId: b.id })
      }
      if (payment?._id === row._id) {
        try {
          const order = await razorpay("orders", "POST", {
            amount: b.total,
            currency: "INR",
            receipt: b.reference,
            notes: { bookingId: b.id },
          })
          if (!order.id || order.amount !== b.total || order.currency !== "INR")
            throw fail(502, "Invalid payment order.")
          await c("Payment").updateOne(
            { _id: row._id, status: "CREATING" },
            { $set: { orderId: order.id, status: "CREATED" } }
          )
          payment = { ...row, orderId: order.id, status: "CREATED" }
        } catch (error) {
          await c("Payment").updateOne(
            { _id: row._id, status: "CREATING" },
            { $set: { status: "RECONCILE_REQUIRED" } }
          )
          throw error
        }
      }
    }
    if (!payment?.orderId)
      throw fail(
        409,
        "Payment order is being created or requires provider reconciliation. Try again shortly or contact support."
      )
    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: "INR",
      bookingId: b.id,
    })
  })
)
export async function settleMongoPayment(orderId: string, paymentId: string) {
  const provider = await razorpay(`payments/${encodeURIComponent(paymentId)}`)
  if (
    provider.status !== "captured" ||
    provider.order_id !== orderId ||
    provider.currency !== "INR"
  )
    throw fail(
      409,
      "Payment is not yet captured. Your reservation is not confirmed."
    )
  const result = await tx(async (session) => {
    const payment = await c("Payment").findOne({ orderId }, options(session))
    if (!payment || payment.amount !== provider.amount)
      throw fail(409, "The provider amount does not match this reservation.")
    const initial = await c("Booking").findOne(
      { id: payment.bookingId },
      options(session)
    )
    if (!initial) throw fail(404, "Reservation not found.")
    await lockProperty(initial.propertyId, session)
    const b = (await c("Booking").findOne(
      { id: initial.id },
      options(session)
    ))!
    if (payment.status === "CAPTURED") {
      if (payment.paymentId !== paymentId)
        throw fail(
          409,
          "A different payment is already recorded for this order."
        )
      return { booking: b, changed: false }
    }
    await c("Payment").updateOne(
      { _id: payment._id },
      { $set: { paymentId, status: "CAPTURED" } },
      options(session)
    )
    const late =
      b.status !== "PENDING" || new Date(b.expiresAt).getTime() <= Date.now()
    const fields = late
      ? { status: "CANCELLED", paymentStatus: "REFUND_PENDING" }
      : { status: "CONFIRMED", paymentStatus: "PAID", expiresAt: null }
    await c("Booking").updateOne(
      { id: b.id },
      { $set: fields },
      options(session)
    )
    if (late) {
      await c("BookingNight").deleteMany({ bookingId: b.id }, options(session))
      await c("Refund").updateOne(
        { bookingId: b.id },
        {
          $setOnInsert: record({
            bookingId: b.id,
            paymentId,
            amount: b.total,
            status: "PENDING",
          }),
        },
        { ...options(session), upsert: true }
      )
    }
    return { booking: { ...b, ...fields }, changed: true }
  })
  if (result.changed)
    await notify(
      result.booking.guestId,
      result.booking.status === "CONFIRMED"
        ? `Payment verified. Reservation ${result.booking.reference} is confirmed.`
        : `Payment arrived after reservation expiry. A full refund is recorded for ${result.booking.reference}.`,
      "/trips"
    )
  return clean(result.booking)
}
r.post(
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
    const b = await c("Booking").findOne({ id: param(req), guestId: uid(req) })
    const p = b ? await c("Payment").findOne({ bookingId: b.id }) : null
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
    res.json(await settleMongoPayment(p.orderId, d.paymentId))
  })
)
r.post(
  "/bookings/:id/payment-failed",
  signed,
  wrap(async (req, res) => {
    if (!(await c("Booking").findOne({ id: param(req), guestId: uid(req) })))
      throw fail(404, "Reservation not found.")
    res.json({
      message:
        "The attempt failed. You can retry before your reservation hold expires.",
    })
  })
)

r.use("/admin", signed, role("ADMIN"))
r.get(
  "/admin/overview",
  wrap(async (_req, res) => {
    const counts: Document = {}
    for (const [key, name, filter] of [
      ["users", "User", {}],
      ["listings", "Property", {}],
      ["bookings", "Booking", {}],
      ["pendingHosts", "Host", { status: "PENDING" }],
      ["pendingListings", "Property", { status: "PENDING" }],
    ] as [string, string, Document][])
      counts[key] = await c(name).countDocuments(filter)
    const paid = await c("Payment")
      .aggregate([
        { $match: { status: "CAPTURED" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray()
    counts.paid = paid[0]?.total || 0
    res.json(counts)
  })
)
const entities: Record<string, [string, string]> = {
  users: ["User", "name"],
  hosts: ["Host", "bio"],
  listings: ["Property", "title"],
  bookings: ["Booking", "reference"],
  payments: ["Payment", "status"],
  refunds: ["Refund", "status"],
  reviews: ["Review", "body"],
  reports: ["Report", "body"],
  categories: ["Category", "name"],
  coupons: ["Coupon", "code"],
  settings: ["Setting", "key"],
  audit: ["Audit", "action"],
}
r.get(
  "/admin/:entity",
  wrap(async (req, res) => {
    const entity = entities[param(req, "entity")]
    if (!entity) throw fail(404, "Admin section not found.")
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(req.query.page || 1)
    const search = z
      .string()
      .max(100)
      .parse(req.query.search || "")
    const pattern = {
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    }
    const filter =
      entity[0] === "User"
        ? { $or: [{ name: pattern }, { email: pattern }] }
        : { [entity[1]]: pattern }
    const items = await c(entity[0])
      .find(filter, { projection: { passwordHash: 0, _id: 0 } })
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * 30)
      .limit(30)
      .toArray()
    res.json({
      items,
      total: await c(entity[0]).countDocuments(filter),
      page,
      pageSize: 30,
    })
  })
)
r.patch(
  "/admin/users/:id",
  wrap(async (req, res) => {
    const d = z
      .object({
        active: z.boolean().optional(),
        role: z.enum(["GUEST", "HOST", "ADMIN"]).optional(),
      })
      .parse(req.body)
    if (
      param(req) === uid(req) &&
      (d.active === false || (d.role && d.role !== "ADMIN"))
    )
      throw fail(
        400,
        "You cannot disable or demote your own administrator account."
      )
    await tx(async (session) => {
      const result = await c("User").updateOne(
        { id: param(req) },
        { $set: d, $inc: { sessionVersion: 1 } },
        options(session)
      )
      if (!result.matchedCount) throw fail(404, "User not found.")
      await audit(uid(req), "USER_UPDATED", param(req), session)
    })
    res.json({ ok: true })
  })
)
r.post(
  "/admin/hosts/:id/decision",
  wrap(async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body)
    await tx(async (session) => {
      const result = await c("Host").updateOne(
        { userId: param(req) },
        { $set: { status: approved ? "APPROVED" : "REJECTED" } },
        options(session)
      )
      if (!result.matchedCount)
        throw fail(404, "Hosting application not found.")
      await c("User").updateOne(
        { id: param(req), role: { $ne: "ADMIN" } },
        { $set: { role: approved ? "HOST" : "GUEST" } },
        options(session)
      )
      if (!approved)
        await c("Property").updateMany(
          { hostId: param(req) },
          {
            $set: { status: "DRAFT", approvedAt: null },
            $inc: { inventoryVersion: 1 },
          },
          options(session)
        )
      await audit(uid(req), "HOST_DECISION", param(req), session)
    })
    res.json({ ok: true })
  })
)
r.post(
  "/admin/listings/:id/decision",
  wrap(async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body)
    await tx(async (session) => {
      const p = await lockProperty(param(req), session)
      if (approved) {
        if (!rentalCity(p.city))
          throw fail(400, "Only stays in Delhi NCR can be approved.")
        const host = await c("User").findOne(
          { id: p.hostId, active: true, role: { $in: ["HOST", "ADMIN"] } },
          options(session)
        )
        if (!host) throw fail(400, "Approve the host first.")
        if (
          !(await c("PropertyImage").countDocuments(
            { propertyId: p.id },
            options(session)
          ))
        )
          throw fail(400, "Upload at least one property photo first.")
        await validCategory(p.category, session)
      }
      await c("Property").updateOne(
        { id: p.id },
        {
          $set: {
            status: approved ? "PUBLISHED" : "REJECTED",
            approvedAt: approved ? new Date() : null,
          },
        },
        options(session)
      )
      await audit(uid(req), "LISTING_MODERATED", p.id!, session)
    })
    res.json({ ok: true })
  })
)
for (const [route, name, schema] of [
  ["reviews", "Review", z.object({ visible: z.boolean() })],
  [
    "reports",
    "Report",
    z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]) }),
  ],
] as const)
  r.patch(
    `/admin/${route}/:id`,
    wrap(async (req, res) => {
      const data = schema.parse(req.body)
      await tx(async (session) => {
        const result = await c(name).updateOne(
          { id: param(req) },
          { $set: data },
          options(session)
        )
        if (!result.matchedCount) throw fail(404, "Record not found.")
        await audit(
          uid(req),
          `${name.toUpperCase()}_UPDATED`,
          param(req),
          session
        )
      })
      res.json({ ok: true })
    })
  )
r.patch(
  "/admin/settings",
  wrap(async (req, res) => {
    const d = z
      .object({
        platformFeeBps: z.coerce.number().int().min(0).max(3000),
        taxBps: z.coerce.number().int().min(0).max(4000),
        banner: z.string().max(300),
      })
      .parse(req.body)
    await tx(async (session) => {
      for (const [key, value] of Object.entries(d))
        await c("Setting").updateOne(
          { key },
          { $set: { value: String(value) }, $setOnInsert: { _id: key, key } },
          { ...options(session), upsert: true }
        )
      await audit(uid(req), "SETTINGS_UPDATED", "platform", session)
    })
    res.json({ ok: true })
  })
)
r.post(
  "/admin/categories",
  wrap(async (req, res) => {
    const { name } = z.object({ name: text(100) }).parse(req.body)
    await c("Category").updateOne(
      { name },
      { $setOnInsert: record({ name, active: true }, name) },
      { upsert: true }
    )
    await audit(uid(req), "CATEGORY_CREATED", name)
    res.status(201).json({ ok: true })
  })
)
r.patch(
  "/admin/categories/:name",
  wrap(async (req, res) => {
    const d = z.object({ active: z.boolean() }).parse(req.body)
    const result = await c("Category").updateOne(
      { name: param(req, "name") },
      { $set: d }
    )
    if (!result.matchedCount) throw fail(404, "Category not found.")
    await audit(uid(req), "CATEGORY_UPDATED", param(req, "name"))
    res.json({ ok: true })
  })
)
r.post(
  "/admin/coupons",
  wrap(async (req, res) => {
    const d = z
      .object({
        code: text(40).regex(/^[A-Z0-9]+$/),
        percent: z.coerce.number().int().min(1).max(50),
        expiresAt: z.string().datetime(),
      })
      .parse(req.body)
    await c("Coupon").updateOne(
      { code: d.code },
      {
        $set: {
          percent: d.percent,
          expiresAt: new Date(d.expiresAt),
          active: true,
        },
        $setOnInsert: { _id: d.code, code: d.code, createdAt: new Date() },
      },
      { upsert: true }
    )
    await audit(uid(req), "COUPON_SAVED", d.code)
    res.status(201).json({ ok: true })
  })
)
r.patch(
  "/admin/coupons/:code",
  wrap(async (req, res) => {
    const d = z.object({ active: z.boolean() }).parse(req.body)
    const result = await c("Coupon").updateOne(
      { code: param(req, "code") },
      { $set: d }
    )
    if (!result.matchedCount) throw fail(404, "Coupon not found.")
    await audit(uid(req), "COUPON_UPDATED", param(req, "code"))
    res.json({ ok: true })
  })
)
r.post(
  "/admin/refunds/:id/process",
  wrap(async (req, res) => {
    const refund = await c("Refund").findOneAndUpdate(
      { id: param(req), status: "PENDING" },
      { $set: { status: "PROCESSING" } },
      { returnDocument: "after" }
    )
    if (!refund)
      throw fail(
        409,
        "This refund is already processed or requires provider reconciliation."
      )
    try {
      const result = await razorpay(
        `payments/${encodeURIComponent(refund.paymentId)}/refund`,
        "POST",
        {
          amount: refund.amount,
          notes: { refundId: refund.id, bookingId: refund.bookingId },
        }
      )
      await tx(async (session) => {
        await c("Refund").updateOne(
          { id: refund.id },
          {
            $set: {
              status:
                result.status === "processed" ? "PROCESSED" : "PROCESSING",
              providerId: result.id,
            },
          },
          options(session)
        )
        await c("Booking").updateOne(
          { id: refund.bookingId },
          {
            $set: {
              paymentStatus:
                result.status === "processed"
                  ? "REFUNDED"
                  : "REFUND_PROCESSING",
            },
          },
          options(session)
        )
        await audit(uid(req), "REFUND_PROCESSED", refund.id!, session)
      })
      res.json({ status: result.status })
    } catch (error) {
      await c("Refund").updateOne(
        { id: refund.id, status: "PROCESSING" },
        { $set: { status: "RECONCILE_REQUIRED" } }
      )
      throw error
    }
  })
)
r.get(
  "/config",
  wrap(async (_req, res) => {
    const settings = await c("Setting").find({}).toArray()
    res.json({
      settings: Object.fromEntries(settings.map((x) => [x.key, x.value])),
      categories: await c("Category").distinct("name", { active: true }),
    })
  })
)

export function mongoRentalWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  Promise.resolve()
    .then(async () => {
      if (
        !Buffer.isBuffer(req.body) ||
        !verifyRentalSignature(
          req.body,
          String(req.headers["x-razorpay-signature"] || ""),
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
      await initializeRentals()
      const eventId = String(
        req.headers["x-razorpay-event-id"] ||
          tokenHash(req.body.toString("utf8"))
      )
      if (await c("PaymentEvent").findOne({ _id: eventId }))
        return res.json({ ok: true })
      if (event.event === "payment.captured") {
        const p = event.payload?.payment?.entity
        if (!p?.id || !p.order_id) throw fail(400, "Malformed payment event.")
        await settleMongoPayment(p.order_id, p.id)
      }
      if (event.event === "refund.processed") {
        const p = event.payload?.refund?.entity
        if (p?.id)
          await tx(async (session) => {
            const refund = await c("Refund").findOneAndUpdate(
              { providerId: p.id },
              { $set: { status: "PROCESSED" } },
              { ...options(session), returnDocument: "after" }
            )
            if (refund)
              await c("Booking").updateOne(
                { id: refund.bookingId },
                { $set: { paymentStatus: "REFUNDED" } },
                options(session)
              )
          })
      }
      await c("PaymentEvent").updateOne(
        { _id: eventId },
        { $setOnInsert: record({ kind: String(event.event) }, eventId) },
        { upsert: true }
      )
      res.json({ ok: true })
    })
    .catch(next)
}
