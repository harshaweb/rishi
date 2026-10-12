import "dotenv/config"
import { readFile } from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { MongoClient } from "mongodb"
const file = process.argv[2]
if (!file) throw Error("Supply a reviewed catalogue JSON file.")
const raw = await readFile(file, "utf8"),
  data = JSON.parse(raw)
const allowedCities = [
  "Delhi",
  "Gurugram",
  "Noida",
  "Greater Noida",
  "Faridabad",
  "Ghaziabad",
]
if (!Array.isArray(data.properties) || !data.properties.length)
  throw Error("Empty catalogue.")
const ids = new Set(data.properties.map((p) => p.id))
if (ids.size !== data.properties.length)
  throw Error("Duplicate property identity.")
for (const p of data.properties) {
  if (
    !allowedCities.includes(p.city) ||
    !Number.isInteger(p.nightlyRate) ||
    p.nightlyRate < 1 ||
    !data.images.some((i) => i.propertyId === p.id)
  )
    throw Error("Incomplete property: " + p.slug)
}
for (const row of [...data.images, ...data.amenities, ...data.blockedDates])
  if (!ids.has(row.propertyId)) throw Error("Unrelated inventory row.")
console.log(
  "Reviewed catalogue:",
  data.properties.length,
  "properties,",
  data.images.length,
  "photos,",
  data.amenities.length,
  "amenities."
)
if (!process.argv.includes("--apply-confirmed")) {
  console.log("Validation only; no database writes.")
  process.exit(0)
}
const ownerEmail = String(process.env.IMPORT_OWNER_EMAIL || "")
  .trim()
  .toLowerCase()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))
  throw Error("Set IMPORT_OWNER_EMAIL privately.")
const target = process.env.IMPORT_MONGODB_URI || process.env.MONGODB_URI
if (!target) throw Error("Set the destination MongoDB URI privately.")
const u = new URL(target)
if (u.pathname === "/") u.pathname = "/omshivraj"
const client = new MongoClient(u.toString(), {
  serverSelectionTimeoutMS: 15000,
})
const marker =
  "reviewed-catalog-" + createHash("sha256").update(raw).digest("hex")
try {
  await client.connect()
  const db = client.db()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      if (
        await db.collection("RentalAudit").findOne({ _id: marker }, { session })
      ) {
        console.log("Catalogue already imported; no changes.")
        return
      }
      const collision = await db
        .collection("RentalProperty")
        .findOne(
          {
            $or: [
              { id: { $in: [...ids] } },
              { slug: { $in: data.properties.map((p) => p.slug) } },
            ],
          },
          { session }
        )
      if (collision)
        throw Error(
          "Destination already contains matching inventory; review before retrying."
        )
      let owner = await db
        .collection("RentalUser")
        .findOne({ email: ownerEmail }, { session })
      const now = new Date()
      if (owner && (!owner.active || owner.role !== "ADMIN"))
        throw Error(
          "Owner must be an active administrator; no existing account will be changed."
        )
      if (!owner) {
        const passwordHash = process.env.IMPORT_OWNER_PASSWORD_HASH || ""
        if (!/^\$2[ab]\$12\$.{53}$/.test(passwordHash))
          throw Error("Supply a securely generated bcrypt password hash.")
        const id = randomUUID()
        owner = {
          _id: id,
          id,
          name: "Omshivraj",
          email: ownerEmail,
          passwordHash,
          role: "ADMIN",
          verified: false,
          active: true,
          sessionVersion: 0,
          createdAt: now,
        }
        await db.collection("RentalUser").insertOne(owner, { session })
        await db
          .collection("RentalProfile")
          .insertOne(
            {
              _id: id,
              userId: id,
              phone: "+91 70781 77772",
              photo: "",
              notifications: true,
              createdAt: now,
            },
            { session }
          )
      }
      await db
        .collection("RentalHost")
        .updateOne(
          { userId: owner.id },
          {
            $setOnInsert: {
              _id: owner.id,
              userId: owner.id,
              status: "APPROVED",
              bio: "Stays in Delhi & Delhi NCR, managed by Omshivraj.",
              createdAt: now,
            },
          },
          { session, upsert: true }
        )
      for (const name of new Set(data.properties.map((p) => p.category)))
        await db
          .collection("RentalCategory")
          .updateOne(
            { name },
            {
              $setOnInsert: {
                _id: name,
                id: name,
                name,
                active: true,
                createdAt: now,
              },
            },
            { upsert: true, session }
          )
      for (const p of data.properties) {
        const { hostId: oldHost, createdAt, updatedAt, approvedAt, ...rest } = p
        void oldHost
        void createdAt
        void updatedAt
        void approvedAt
        const description = String(p.description).split(
          "\n\nThis is an illustrative demonstration listing"
        )[0]
        await db
          .collection("RentalProperty")
          .insertOne(
            {
              ...rest,
              _id: p.id,
              id: p.id,
              hostId: owner.id,
              demo: false,
              status: "PUBLISHED",
              description,
              address: `${p.city}, Delhi NCR, India`,
              latitude: null,
              longitude: null,
              bookingMode: "HOST_APPROVAL",
              instantBook: false,
              createdAt: now,
              updatedAt: now,
              approvedAt: now,
              inventoryVersion: 0,
            },
            { session }
          )
      }
      if (data.images.length)
        await db
          .collection("RentalPropertyImage")
          .insertMany(data.images, { session })
      if (data.amenities.length)
        await db
          .collection("RentalPropertyAmenity")
          .insertMany(data.amenities, { session })
      if (data.blockedDates.length)
        await db.collection("RentalBlockedDate").insertMany(
          data.blockedDates.map((d) => ({
            ...d,
            start: new Date(d.start),
            end: new Date(d.end),
          })),
          { session }
        )
      await db
        .collection("RentalAudit")
        .insertOne(
          {
            _id: marker,
            id: marker,
            userId: owner.id,
            action: "CONFIRMED_CATALOG_IMPORT",
            entityId: marker,
            createdAt: now,
            details: {
              propertyCount: data.properties.length,
              source: "Owner-confirmed local catalogue",
              exactAddressesPending: true,
            },
          },
          { session }
        )
      console.log(
        "Imported confirmed listings:",
        data.properties.length,
        "with photos and amenities; existing accounts and bookings preserved."
      )
    })
  } finally {
    await session.endSession()
  }
  const count = await db
    .collection("RentalProperty")
    .countDocuments({ id: { $in: [...ids] }, status: "PUBLISHED", demo: false })
  if (count !== data.properties.length)
    throw Error("Post-import verification failed.")
  console.log("VERIFIED_PUBLISHED_LISTINGS", count)
} finally {
  await client.close()
}
