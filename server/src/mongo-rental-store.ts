import { randomUUID } from "node:crypto"
import type { ClientSession, Document, Filter } from "mongodb"
import { mongo, mongoClient } from "./db.js"
import { rentalFail as fail } from "./rental-errors.js"
import {
  calculateHourlyRentalPrice,
  calculateRentalPrice,
  rentalDates,
  rentalHours,
  rentalEmail,
} from "./rental-utils.js"
import { rentalCategories } from "../shared/rentals.js"
import { rentalNightlyRate } from "../shared/rentals.js"
import { rentalCities } from "../shared/rental-region.js"

// UUID strings are deliberately preserved during migration, including foreign keys.
export type Row = Document & { _id: string; id?: string }
export const rid = () => randomUUID()
export const collection = (name: string) => {
  if (!mongo) throw fail(503, "MongoDB is not configured.")
  return mongo.collection<Row>(`Rental${name}`)
}
export const options = (session?: ClientSession) => ({ session })
export const record = (data: Document, id: string = rid()): Row => ({
  _id: id,
  id,
  createdAt: new Date(),
  ...data,
})
export const clean = (row: Document | null) => {
  if (!row) return null
  const { _id: ignored, passwordHash: secret, ...data } = row
  void ignored
  void secret
  return data
}
let initialized: Promise<void> | undefined
export function initializeRentals() {
  initialized ||= initialize().catch((error) => {
    initialized = undefined
    throw error
  })
  return initialized
}
async function initialize() {
  const unique: [string, Document][] = [
    ["User", { email: 1 }],
    ["Profile", { userId: 1 }],
    ["Host", { userId: 1 }],
    ["Property", { slug: 1 }],
    ["Booking", { idempotencyKey: 1 }],
    ["Booking", { reference: 1 }],
    ["BookingNight", { propertyId: 1, night: 1 }],
    ["Payment", { bookingId: 1 }],
    ["Review", { bookingId: 1 }],
    ["Token", { hash: 1 }],
    ["IdentityVerification", { userId: 1, provider: 1 }],
    ["IdentityAttempt", { stateHash: 1 }],
    ["Refund", { bookingId: 1 }],
    ["Conversation", { propertyId: 1, guestId: 1 }],
    ["WishlistItem", { wishlistId: 1, propertyId: 1 }],
    ["Category", { name: 1 }],
    ["Coupon", { code: 1 }],
    ["Setting", { key: 1 }],
  ]
  for (const [name, keys] of unique)
    await collection(name).createIndex(keys, { unique: true })
  await collection("IdentityAttempt").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  for (const key of ["orderId", "paymentId"])
    await collection("Payment").createIndex(
      { [key]: 1 },
      { unique: true, partialFilterExpression: { [key]: { $type: "string" } } }
    )
  for (const [name, keys] of [
    ["Property", { status: 1, city: 1, category: 1 }],
    ["PropertyImage", { propertyId: 1, position: 1 }],
    ["PropertyAmenity", { propertyId: 1 }],
    ["Booking", { propertyId: 1, status: 1, checkIn: 1, checkOut: 1 }],
    ["Booking", { guestId: 1, createdAt: -1 }],
    ["Message", { conversationId: 1, createdAt: 1 }],
    ["Notification", { userId: 1, createdAt: -1 }],
    ["BlockedDate", { propertyId: 1, start: 1, end: 1 }],
  ] as [string, Document][])
    await collection(name).createIndex(keys)
  for (const name of rentalCategories)
    await collection("Category").updateOne(
      { name },
      { $setOnInsert: record({ name, active: true }, name) },
      { upsert: true }
    )
  for (const [key, value] of Object.entries({
    platformFeeBps: "500",
    taxBps: "0",
    banner: "",
  }))
    await collection("Setting").updateOne(
      { key },
      { $setOnInsert: record({ key, value }, key) },
      { upsert: true }
    )
}
export async function transaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  await initializeRentals()
  if (!mongoClient) throw fail(503, "MongoDB is not configured.")
  const session = mongoClient.startSession()
  try {
    // Never run parallel operations in this callback: the driver can retry it.
    return (await session.withTransaction(() => fn(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: 15000,
    })) as T
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      throw fail(
        409,
        "These dates or details have just been taken. Refresh and try again."
      )
    throw error
  } finally {
    await session.endSession()
  }
}
export async function lockProperty(id: string, session: ClientSession) {
  // All inventory writers contend on the same document, preventing snapshot write skew.
  const p = await collection("Property").findOneAndUpdate(
    { id },
    { $inc: { inventoryVersion: 1 } },
    { ...options(session), returnDocument: "after" }
  )
  if (!p) throw fail(404, "Stay not found.")
  return p
}
export async function audit(
  userId: string,
  action: string,
  entityId: string,
  session?: ClientSession
) {
  await collection("Audit").insertOne(
    record({ userId, action, entityId }),
    options(session)
  )
}
export async function notify(userId: string, body: string, link: string) {
  const row = record({
    userId,
    body,
    link,
    readAt: null,
    emailStatus: "NOT_CONFIGURED",
  })
  await collection("Notification").insertOne(row)
  const user = await collection("User").findOne({ id: userId, active: true })
  const profile = await collection("Profile").findOne({ userId })
  if (user && profile?.notifications !== false) {
    const emailStatus = await rentalEmail(
      user.email,
      body,
      `Open your Omshivraj account: ${process.env.SITE_URL || "http://localhost:5173"}${link}`
    )
    await collection("Notification").updateOne(
      { _id: row._id },
      { $set: { emailStatus } }
    )
  }
}
function propertyPipeline(filter: Filter<Row>, publicOnly: boolean) {
  const pipeline: Document[] = [
    { $match: filter },
    {
      $lookup: {
        from: "RentalUser",
        localField: "hostId",
        foreignField: "id",
        as: "host",
      },
    },
    { $unwind: "$host" },
  ]
  if (publicOnly)
    pipeline.push(
      {
        $match: {
          status: "PUBLISHED",
          city: { $in: [...rentalCities] },
          "host.active": true,
        },
      },
      {
        $lookup: {
          from: "RentalCategory",
          localField: "category",
          foreignField: "name",
          as: "categories",
        },
      },
      { $match: { categories: { $elemMatch: { active: true } } } },
      // Full street addresses belong to confirmed reservations and host editing.
      { $set: { address: { $concat: ["$city", ", India"] } } }
    )
  return pipeline
}
function enrichmentPipeline(): Document[] {
  return [
    {
      $lookup: {
        from: "RentalPropertyImage",
        let: { id: "$id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$propertyId", "$$id"] } } },
          { $sort: { position: 1 } },
        ],
        as: "photos",
      },
    },
    {
      $lookup: {
        from: "RentalPropertyAmenity",
        localField: "id",
        foreignField: "propertyId",
        as: "features",
      },
    },
    {
      $lookup: {
        from: "RentalReview",
        let: { id: "$id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$propertyId", "$$id"] },
                  { $eq: ["$visible", true] },
                ],
              },
            },
          },
        ],
        as: "reviews",
      },
    },
    {
      $set: {
        hostName: "$host.name",
        images: "$photos.url",
        amenities: "$features.amenity",
        rating: { $avg: "$reviews.rating" },
        reviewCount: { $size: "$reviews" },
      },
    },
    {
      $project: {
        _id: 0,
        host: 0,
        photos: 0,
        features: 0,
        reviews: 0,
        categories: 0,
        inventoryVersion: 0,
      },
    },
  ]
}
export async function properties(
  filter: Filter<Row> = {},
  session?: ClientSession,
  publicOnly = false,
  limit = 1000
) {
  await initializeRentals()
  const pipeline = [
    ...propertyPipeline(filter, publicOnly),
    { $sort: { createdAt: -1, id: 1 } },
    { $limit: limit },
    ...enrichmentPipeline(),
  ]
  return collection("Property").aggregate(pipeline, options(session)).toArray()
}
export async function searchProperties(
  filter: Filter<Row>,
  data: {
    checkIn: string
    checkOut: string
    guests: number
    minPrice: number
    maxPrice: number
    amenities: string
    rating: number
    sort: string
    page: number
  }
) {
  const pipeline: Document[] = [
    ...propertyPipeline(filter, true),
    ...enrichmentPipeline(),
    {
      $addFields: {
        nightlyRate: {
          $cond: [
            { $and: [{ $gte: [data.guests, 2] }, { $gte: ["$capacity", 2] }] },
            359900,
            "$nightlyRate",
          ],
        },
      },
    },
    {
      $match: {
        nightlyRate: {
          $gte: Math.round(data.minPrice * 100),
          $lte: Math.round(data.maxPrice * 100),
        },
      },
    },
  ]
  const amenities = [...new Set(data.amenities.split(",").filter(Boolean))]
  pipeline.push({
    $match: {
      ...(amenities.length ? { amenities: { $all: amenities } } : {}),
      ...(data.rating ? { rating: { $gte: data.rating } } : {}),
    },
  })
  if (data.checkIn) {
    for (const [from, start, end, extra] of [
      ["RentalBlockedDate", "start", "end", {}],
      ["RentalBooking", "checkIn", "checkOut", activeBookingFilter()],
    ] as [string, string, string, Document][])
      pipeline.push(
        {
          $lookup: {
            from,
            let: { id: "$id" },
            pipeline: [
              {
                $match: {
                  ...extra,
                  $expr: {
                    $and: [
                      { $eq: ["$propertyId", "$$id"] },
                      { $lt: [`$${start}`, data.checkOut] },
                      { $gt: [`$${end}`, data.checkIn] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "conflicts",
          },
        },
        { $match: { "conflicts.0": { $exists: false } } }
      )
    pipeline.push({ $unset: "conflicts" })
  }
  const sort: Record<string, Document> = {
    recommended: { createdAt: -1, id: 1 },
    "price-asc": { nightlyRate: 1, id: 1 },
    "price-desc": { nightlyRate: -1, id: 1 },
    rating: { rating: -1, id: 1 },
  }
  pipeline.push({
    $facet: {
      items: [
        { $sort: sort[data.sort] },
        { $skip: (data.page - 1) * 24 },
        { $limit: 24 },
      ],
      count: [{ $count: "total" }],
    },
  })
  const [result] = await collection("Property").aggregate(pipeline).toArray()
  return {
    items: result?.items || [],
    total: result?.count[0]?.total || 0,
    page: data.page,
    pageSize: 24,
  }
}
export async function destinations(query: string) {
  const regex = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return collection("Property")
    .aggregate([
      ...propertyPipeline({ city: { $regex: regex, $options: "i" } }, true),
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, city: "$_id", count: 1 } },
    ])
    .toArray()
}
export async function mongoPublicRentals(slug?: string) {
  return properties(slug ? { slug } : {}, undefined, true, 48)
}
export async function expire(propertyId: string, session: ClientSession) {
  const expired = await collection("Booking")
    .find(
      { propertyId, status: "PENDING", expiresAt: { $lte: new Date() } },
      options(session)
    )
    .toArray()
  if (!expired.length) return
  const ids = expired.map((b) => b.id)
  await collection("Booking").updateMany(
    { id: { $in: ids } },
    { $set: { status: "CANCELLED", cancelReason: "Reservation hold expired" } },
    options(session)
  )
  await collection("BookingNight").deleteMany(
    { bookingId: { $in: ids } },
    options(session)
  )
}
export async function expireAll() {
  const ids = await collection("Booking").distinct("propertyId", {
    status: "PENDING",
    expiresAt: { $lte: new Date() },
  })
  for (const id of ids)
    await transaction(async (session) => {
      await lockProperty(id, session)
      await expire(id, session)
    })
  await collection("Booking").updateMany(
    {
      status: "CONFIRMED",
      checkOut: { $lte: new Date().toISOString().slice(0, 10) },
    },
    { $set: { status: "COMPLETED" } }
  )
}
export const activeBookingFilter = () => ({
  $or: [
    { status: { $in: ["CONFIRMED", "COMPLETED"] } },
    { status: "PENDING", expiresAt: { $gt: new Date() } },
  ],
})
export async function available(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  session?: ClientSession
) {
  const blocked = await collection("BlockedDate").findOne(
    { propertyId, start: { $lt: checkOut }, end: { $gt: checkIn } },
    options(session)
  )
  if (blocked) return false
  return !(await collection("Booking").findOne(
    {
      propertyId,
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
      ...activeBookingFilter(),
    },
    options(session)
  ))
}
export async function quote(
  p: Document,
  checkIn: string,
  checkOut: string,
  code = "",
  session?: ClientSession,
  bookingType: "OVERNIGHT" | "HOURLY" = "OVERNIGHT",
  arrivalTime = "10:00",
  departureTime = "13:00",
  guests = 1
) {
  const nights = rentalDates(checkIn, checkOut)
  const rows = await collection("Setting").find({}, options(session)).toArray()
  const config = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]))
  let percent = Number(p.discountPercent || 0)
  if (code) {
    const coupon = await collection("Coupon").findOne(
      {
        code: code.toUpperCase(),
        active: true,
        expiresAt: { $gt: new Date() },
      },
      options(session)
    )
    if (!coupon) throw fail(400, "This promotion is not available.")
    percent = Math.max(percent, coupon.percent)
  }
  if (bookingType === "HOURLY") {
    if (nights !== 1) throw fail(400, "Hourly bookings are for one day only.")
    return calculateHourlyRentalPrice(
      rentalHours(arrivalTime, departureTime),
      p.cleaningFee,
      config.platformFeeBps ?? 500,
      config.taxBps ?? 0,
      percent
    )
  }
  return calculateRentalPrice(
    rentalNightlyRate({ nightlyRate: Number(p.nightlyRate), capacity: Number(p.capacity) }, guests),
    nights,
    p.cleaningFee,
    config.platformFeeBps ?? 500,
    config.taxBps ?? 0,
    percent
  )
}
export async function bookingRows(filter: Filter<Row>) {
  return collection("Booking")
    .aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: "RentalProperty",
          localField: "propertyId",
          foreignField: "id",
          as: "property",
        },
      },
      { $unwind: "$property" },
      {
        $lookup: {
          from: "RentalUser",
          localField: "guestId",
          foreignField: "id",
          as: "guest",
        },
      },
      { $unwind: "$guest" },
      {
        $lookup: {
          from: "RentalPropertyImage",
          let: { id: "$propertyId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$propertyId", "$$id"] } } },
            { $sort: { position: 1 } },
            { $limit: 1 },
          ],
          as: "photos",
        },
      },
      {
        $lookup: {
          from: "RentalReview",
          localField: "id",
          foreignField: "bookingId",
          as: "reviews",
        },
      },
      {
        $lookup: {
          from: "RentalRefund",
          localField: "id",
          foreignField: "bookingId",
          as: "refunds",
        },
      },
      {
        $set: {
          title: "$property.title",
          city: "$property.city",
          address: {
            $cond: [
              { $in: ["$status", ["CONFIRMED", "COMPLETED"]] },
              "$property.address",
              { $concat: ["$property.city", ", India"] },
            ],
          },
          slug: "$property.slug",
          hostId: "$property.hostId",
          guestName: "$guest.name",
          image: { $arrayElemAt: ["$photos.url", 0] },
          reviewId: { $arrayElemAt: ["$reviews.id", 0] },
          refund: { $ifNull: [{ $arrayElemAt: ["$refunds.amount", 0] }, 0] },
        },
      },
      {
        $project: {
          _id: 0,
          property: 0,
          guest: 0,
          photos: 0,
          reviews: 0,
          refunds: 0,
        },
      },
    ])
    .toArray()
}
