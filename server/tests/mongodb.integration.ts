import assert from "node:assert/strict"
import request from "supertest"
import bcrypt from "bcryptjs"
import { randomUUID, createHmac, createHash } from "node:crypto"
import { MongoClient, type Document } from "mongodb"

if (
  process.env.NODE_ENV !== "test" ||
  !process.env.MONGODB_URI?.includes("/omshivraj_test") ||
  !process.env.MONGODB_URI.startsWith("mongodb://127.0.0.1:")
)
  throw Error("Tests require a disposable local test database.")
const { app, apiError } = await import("../src/app.js")
app.use(apiError)
const { disconnect, mongo } = await import("../src/db.js")
const {
  collection: c,
  record,
  initializeRentals,
  available,
} = await import("../src/mongo-rental-store.js")
const { getPublicContent } = await import("../src/content.js")
const { settleMongoPayment } = await import("../src/mongo-rental-api.js")
const secret = "Mongo-Test-Only-Password-2026",
  origin = "http://localhost:5173"
let checks = 0
const equal = (a: unknown, b: unknown, label: string) => {
  assert.deepEqual(a, b, label)
  checks++
  console.log(`PASS ${label}`)
}
const date = (d: number) =>
  new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
type Client = { agent: ReturnType<typeof request.agent>; csrf: string }
const guestId = randomUUID(),
  hostId = randomUUID(),
  otherId = randomUUID(),
  adminId = randomUUID(),
  propertyId = randomUUID()
async function login(id: string): Promise<Client> {
  const agent = request.agent(app)
  const session = await agent.get("/api/rental/session")
  const response = await agent
    .post("/api/rental/login")
    .set("Origin", origin)
    .set("X-CSRF-Token", session.body.csrf)
    .send({ email: `${id}@test.invalid`, password: secret })
  equal(
    response.status,
    200,
    `Login ${id === adminId ? "admin" : id === hostId ? "host" : "guest"}`
  )
  return { agent, csrf: response.body.csrf }
}
function send(
  client: Client,
  method: "post" | "patch" | "delete",
  path: string,
  body: unknown = {}
) {
  return client.agent[method](`/api/rental${path}`)
    .set("Origin", origin)
    .set("X-CSRF-Token", client.csrf)
    .send(body)
}
const booking = (days: number, key = randomUUID()) => ({
  propertyId,
  checkIn: date(days),
  checkOut: date(days + 2),
  guests: 2,
  idempotencyKey: key,
  total: 1,
  role: "ADMIN",
})
const originalFetch = globalThis.fetch
const providerPayments = new Map<
  string,
  {
    id: string
    order_id: string
    amount: number
    currency: string
    status: string
  }
>()
let orderCount = 0,
  refundCount = 0
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url === "https://api.razorpay.com/v1/orders") {
    orderCount++
    const b = JSON.parse(String(init?.body))
    return Response.json({
      id: `order_${orderCount}`,
      amount: b.amount,
      currency: b.currency,
    })
  }
  if (url.endsWith("/refund")) {
    refundCount++
    return Response.json({ id: `refund_${refundCount}`, status: "processed" })
  }
  const p = providerPayments.get(url.split("/").pop() || "")
  if (p) return Response.json(p)
  return originalFetch(input, init)
}
try {
  await initializeRentals()
  const passwordHash = await bcrypt.hash(secret, 4)
  for (const [id, role] of [
    [guestId, "GUEST"],
    [hostId, "HOST"],
    [otherId, "GUEST"],
    [adminId, "ADMIN"],
  ]) {
    await c("User").insertOne(
      record(
        {
          name: role,
          email: `${id}@test.invalid`,
          passwordHash,
          role,
          active: true,
          verified: true,
          sessionVersion: 0,
        },
        id
      )
    )
    await c("Profile").insertOne(
      record({ userId: id, phone: "", photo: "", notifications: true }, id)
    )
  }
  await c("Host").insertOne(
    record({ userId: hostId, bio: "Test host", status: "APPROVED" }, hostId)
  )
  const base = {
    hostId,
    title: "Test Delhi stay",
    city: "Delhi",
    address: "Test address",
    category: "City stays",
    type: "Apartment",
    description: "Integration test property",
    nightlyRate: 200000,
    cleaningFee: 10000,
    capacity: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    latitude: 28.6,
    longitude: 77.2,
    cancellation: "FLEXIBLE",
    bookingMode: "HOST_APPROVAL",
    instantBook: false,
    checkInTime: "15:00",
    checkOutTime: "11:00",
    houseRules: "No parties",
    discountPercent: 0,
    status: "PUBLISHED",
    approvedAt: new Date(),
    demo: true,
  }
  await c("Property").insertOne(
    record({ ...base, slug: "test-delhi-stay" }, propertyId)
  )
  await c("PropertyImage").insertOne(
    record({ propertyId, url: "/gallery/property-01.jpg", position: 0 })
  )
  await c("PropertyAmenity").insertOne(record({ propertyId, amenity: "Wi-Fi" }))
  const guest = await login(guestId),
    host = await login(hostId),
    other = await login(otherId),
    admin = await login(adminId)
  equal(
    (await request(app).get("/api/health")).status,
    200,
    "MongoDB health endpoint"
  )
  equal(
    (await request(app).get("/api/content")).status,
    200,
    "Frontend content API uses MongoDB"
  )
  equal(
    (await getPublicContent()).rentals.length,
    1,
    "SSR content includes MongoDB listings"
  )
  equal(
    (
      await request(app).get(
        "/api/rental/search?destination=Delhi&amenities=Wi-Fi"
      )
    ).body.total,
    1,
    "Destination/amenity search"
  )
  equal(
    (await request(app).get("/api/rental/search?maxPrice=100")).body.total,
    0,
    "Price filter retains frontend contract"
  )
  equal(
    (await request(app).get("/api/rental/search?checkIn=" + date(5))).status,
    400,
    "Paired dates validation"
  )
  equal(
    (await request(app).get("/api/rental/destinations?q=Delhi")).body[0].city,
    "Delhi",
    "Destination suggestions"
  )
  equal(
    (await request(app).get("/api/rental/properties/test-delhi-stay")).body
      .images.length,
    1,
    "Property details and images"
  )
  equal(
    (await request(app).get("/api/rental/properties/test-delhi-stay")).body
      .address,
    "Delhi, India",
    "Public property details keep the street address private"
  )
  equal(
    (await request(app).get("/api/rental/search")).body.items[0].address,
    "Delhi, India",
    "Public search keeps the street address private"
  )
  equal(
    (await request(app).get("/api/rental/config")).body.categories.includes(
      "City stays"
    ),
    true,
    "Categories/configuration"
  )
  equal(
    (await send(guest, "post", `/properties/${propertyId}/quote`, booking(5)))
      .body.total,
    745000,
    "Server calculated price; ignores client total"
  )
  equal(
    (await guest.agent.post("/api/rental/bookings").send(booking(5))).status,
    403,
    "CSRF required"
  )
  equal(
    (
      await send(guest, "patch", "/admin/settings", {
        platformFeeBps: 0,
        taxBps: 0,
        banner: "",
      })
    ).status,
    403,
    "Guest cannot use admin endpoints"
  )
  equal(
    (
      await send(other, "patch", `/host/listings/${propertyId}`, {
        title: "Stolen",
      })
    ).status,
    403,
    "Guest cannot edit host listings"
  )
  const key = randomUUID(),
    payload = booking(10, key)
  equal((await send(guest, "post", "/bookings", { ...booking(6), expectedTotal: 1 })).status, 409, "Changed booking price requires a new guest review")
  equal(await available(propertyId, date(6), date(8)), true, "Price mismatch creates no inventory hold")
  const acceptedQuote = await send(guest, "post", `/properties/${propertyId}/quote`, payload)
  Object.assign(payload, { expectedTotal: acceptedQuote.body.total })
  const first = await send(guest, "post", "/bookings", payload)
  equal(first.status, 201, "Create booking transaction")
  equal(
    (await guest.agent.get("/api/rental/bookings")).body.find(
      (row: { id: string }) => row.id === first.body.id
    )?.address,
    "Delhi, India",
    "Pending reservation does not disclose the street address"
  )
  equal(
    (await send(guest, "post", "/bookings", payload)).body.id,
    first.body.id,
    "Booking idempotency"
  )
  equal(
    (await send(other, "post", "/bookings", payload)).status,
    409,
    "Idempotency belongs to original guest"
  )
  equal(
    (await send(host, "post", "/bookings", booking(12))).status,
    400,
    "Host cannot book own property"
  )
  const races = await Promise.all([
    send(guest, "post", "/bookings", booking(20)),
    send(other, "post", "/bookings", booking(20)),
  ])
  equal(
    races.map((r) => r.status).sort(),
    [201, 409],
    "Concurrent guests: exactly one reservation wins"
  )
  equal(
    await c("BookingNight").countDocuments({ propertyId, night: date(20) }),
    1,
    "Unique per-night inventory"
  )
  equal(
    (await send(host, "post", `/listings/${propertyId}/blocks`, {})).status,
    404,
    "Unknown API routes return 404"
  )
  equal(
    (
      await send(host, "post", `/host/listings/${propertyId}/blocks`, {
        start: date(10),
        end: date(12),
      })
    ).status,
    409,
    "Host block cannot overlap pending booking"
  )
  equal(
    (await send(host, "post", `/host/reservations/${first.body.id}/accept`))
      .status,
    200,
    "Host confirms pay-at-property reservation"
  )
  equal(
    (await guest.agent.get("/api/rental/bookings")).body.find(
      (b: Document) => b.id === first.body.id
    ).paymentStatus,
    "PAY_AT_PROPERTY",
    "Trips includes confirmed reservation"
  )
  equal(
    (await guest.agent.get("/api/rental/bookings")).body.find(
      (row: { id: string }) => row.id === first.body.id
    )?.address,
    base.address,
    "Confirmed guest receives the full property address"
  )
  equal(
    (await send(other, "post", `/bookings/${first.body.id}/cancel`)).status,
    404,
    "Booking ownership on cancellation"
  )
  equal(
    (await send(guest, "post", `/bookings/${first.body.id}/cancel`)).status,
    200,
    "Guest cancellation releases inventory"
  )
  equal(
    await available(propertyId, date(10), date(12)),
    true,
    "Cancelled dates become available"
  )
  const blocked = await send(
    host,
    "post",
    `/host/listings/${propertyId}/blocks`,
    { start: date(30), end: date(32), reason: "Maintenance" }
  )
  equal(blocked.status, 201, "Create host calendar block")
  const calendar = await host.agent.get("/api/rental/host/calendar")
  equal(calendar.body.length, 1, "Host calendar lists block")
  equal((await admin.agent.get("/api/rental/host/calendar")).body.length, 1, "Admin calendar includes another host's blocked dates")
  equal((await guest.agent.get("/api/rental/host/calendar")).status, 403, "Guest cannot access availability management")
  equal((await admin.agent.get("/api/rental/host/listings")).body.some((p: Document) => p.id === propertyId), true, "Admin listing picker includes another host's property")
  equal(
    (await send(guest, "post", "/bookings", booking(30))).status,
    409,
    "Blocked dates reject guest bookings"
  )
  equal(
    (await send(host, "delete", `/host/blocks/${calendar.body[0].id}`)).status,
    200,
    "Remove host calendar block"
  )
  const expired = await send(guest, "post", "/bookings", booking(40))
  await c("Booking").updateOne(
    { id: expired.body.id },
    { $set: { expiresAt: new Date(0) } }
  )
  const replacement = await send(other, "post", "/bookings", booking(40))
  equal(replacement.status, 201, "Expired hold reclaimed transactionally")
  equal(
    (await c("Booking").findOne({ id: expired.body.id }))?.status,
    "CANCELLED",
    "Expired booking state persisted"
  )
  const adminRequest = await send(guest, "post", "/bookings", booking(80))
  equal(adminRequest.status, 201, "Create request for admin confirmation")
  equal((await send(guest, "post", `/host/reservations/${adminRequest.body.id}/accept`)).status, 403, "Guest cannot confirm a reservation")
  equal((await send(admin, "post", `/host/reservations/${adminRequest.body.id}/accept`)).status, 200, "Admin confirms another host's reservation")
  equal((await c("Booking").findOne({ id: adminRequest.body.id }))?.paymentStatus, "PAY_AT_PROPERTY", "Admin confirmation cannot mark an unpaid stay as paid")
  equal(await c("Audit").countDocuments({ action: "ADMIN_CONFIRMED", entityId: adminRequest.body.id }), 1, "Admin confirmation records its actor in audit")
  equal((await admin.agent.get("/api/rental/host/reservations")).body.some((b: Document) => b.id === adminRequest.body.id), true, "Admin availability includes another host's reservations")
  equal((await send(admin, "post", `/bookings/${adminRequest.body.id}/cancel`)).status, 200, "Admin cancels another host's reservation")
  equal(await available(propertyId, date(80), date(82)), true, "Admin cancellation releases reserved dates")
  equal((await send(admin, "post", `/host/reservations/${adminRequest.body.id}/accept`)).status, 409, "Admin cannot revive a cancelled reservation")
  const list = await send(guest, "post", "/wishlists", { name: "Weekend" })
  equal(list.status, 201, "Create wishlist")
  equal(
    (
      await send(guest, "post", `/wishlists/${list.body.id}/items`, {
        propertyId,
      })
    ).status,
    200,
    "Save stay to wishlist"
  )
  equal(
    (await guest.agent.get("/api/rental/wishlists")).body.items.length,
    1,
    "Wishlist returns property cards"
  )
  equal(
    (await send(other, "delete", `/wishlists/${list.body.id}`)).status,
    404,
    "Wishlist owner isolation"
  )
  equal(
    (
      await send(guest, "patch", `/wishlists/${list.body.id}`, {
        name: "Delhi",
      })
    ).status,
    200,
    "Rename wishlist"
  )
  equal(
    (
      await send(
        guest,
        "delete",
        `/wishlists/${list.body.id}/items/${propertyId}`
      )
    ).status,
    200,
    "Remove wishlist item"
  )
  equal(
    (await send(guest, "delete", `/wishlists/${list.body.id}`)).status,
    200,
    "Delete wishlist"
  )
  const thread = await send(guest, "post", "/conversations", {
    propertyId,
    body: "Is parking available?",
  })
  equal(thread.status, 201, "Contact host creates conversation")
  equal(
    (await other.agent.get(`/api/rental/conversations/${thread.body.id}`))
      .status,
    404,
    "Messages hidden from unrelated user"
  )
  equal(
    (await host.agent.get("/api/rental/conversations")).body[0].unread,
    1,
    "Unread messages counted"
  )
  equal(
    (await host.agent.get(`/api/rental/conversations/${thread.body.id}`))
      .body[0].body,
    "Is parking available?",
    "Read conversation"
  )
  equal(
    (
      await send(host, "post", `/conversations/${thread.body.id}`, {
        body: "Yes, parking is included.",
      })
    ).status,
    201,
    "Host sends reply"
  )
  equal(
    (await guest.agent.get("/api/rental/notifications")).body.length > 0,
    true,
    "Booking/message notifications"
  )
  equal(
    (await send(guest, "post", "/notifications/read")).status,
    200,
    "Mark notifications read"
  )
  equal(
    (
      await send(guest, "post", "/reports", {
        targetId: propertyId,
        body: "Review this listing",
      })
    ).status,
    201,
    "Create moderation report"
  )
  equal(
    (
      await send(guest, "patch", "/profile", {
        name: "Test Traveller",
        phone: "+917078177772",
        notifications: false,
      })
    ).body.phone,
    "+917078177772",
    "Update profile"
  )
  equal(
    (
      await send(other, "post", "/host/onboard", {
        bio: "I have an apartment in Delhi.",
      })
    ).status,
    200,
    "Hosting application"
  )
  equal(
    (await other.agent.get("/api/rental/host/status")).body.status,
    "PENDING",
    "Hosting remains pending approval"
  )
  equal(
    (
      await send(admin, "post", `/admin/hosts/${otherId}/decision`, {
        approved: true,
      })
    ).status,
    200,
    "Admin approves host"
  )
  const newHost = await login(otherId)
  const create = await send(newHost, "post", "/host/listings", {
    ...base,
    slug: "new-noida-stay",
    city: "Noida",
    title: "New Noida stay",
    latitude: "",
    longitude: "",
    amenities: ["Wi-Fi"],
  })
  equal(create.status, 201, "Approved host creates draft listing")
  const createdLocation = (
    await newHost.agent.get(`/api/rental/host/listings/${create.body.id}`)
  ).body
  equal(
    [createdLocation.latitude, createdLocation.longitude],
    [null, null],
    "Blank property coordinates stay unknown instead of becoming zero"
  )
  equal(
    (
      await send(host, "patch", `/host/listings/${create.body.id}`, {
        title: "Wrong owner",
      })
    ).status,
    404,
    "Host-to-host ownership enforcement"
  )
  equal(
    (
      await send(newHost, "patch", `/host/listings/${create.body.id}`, {
        title: "Updated Noida stay",
      })
    ).status,
    200,
    "Listing edit"
  )
  const editedLocation = (
    await newHost.agent.get(`/api/rental/host/listings/${create.body.id}`)
  ).body
  equal(
    [editedLocation.latitude, editedLocation.longitude],
    [null, null],
    "Editing a property preserves unknown location coordinates"
  )
  equal(
    (
      await send(newHost, "post", `/host/listings/${create.body.id}/publish`, {
        publish: true,
      })
    ).status,
    400,
    "Publishing requires photos"
  )
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cSioAAAAASUVORK5CYII=",
    "base64"
  )
  const upload = await newHost.agent
    .post(`/api/rental/host/listings/${create.body.id}/photos`)
    .set("Origin", origin)
    .set("X-CSRF-Token", newHost.csrf)
    .attach("image", png, { filename: "test.png", contentType: "image/png" })
  equal(upload.status, 201, "Upload property photo and persist metadata")
  const mediaId = upload.body.url.split("/").pop()
  const asset = await mongo!.collection("MediaAsset").findOne({ _id: mediaId })
  equal(
    Boolean(asset?.key?.startsWith("mongo:")),
    true,
    "Uploads use durable MongoDB storage"
  )
  const downloaded = await request(app).get(upload.body.url)
  equal(downloaded.status, 200, "Uploaded image is publicly readable")
  equal(downloaded.body, png, "Downloaded image matches original bytes")
  const { readStored, removeStored, saveFile } =
    await import("../src/storage.js")
  const previousMode = process.env.NODE_ENV
  let productionAsset
  try {
    process.env.NODE_ENV = "production"
    productionAsset = await saveFile(
      {
        buffer: png,
        mimetype: "image/png",
        originalname: "production.png",
        size: png.length,
      } as Express.Multer.File,
      true
    )
  } finally {
    process.env.NODE_ENV = previousMode
  }
  equal(
    await readStored(productionAsset!.key),
    png,
    "Production upload works without S3"
  )
  // A separate client must see the file; it cannot depend on this process's disk.
  const reader = new MongoClient(process.env.MONGODB_URI!)
  try {
    await reader.connect()
    const { GridFSBucket } = await import("mongodb")
    const bucket = new GridFSBucket(reader.db(), { bucketName: "Uploads" })
    const chunks: Buffer[] = []
    for await (const chunk of bucket.openDownloadStreamByName(
      productionAsset!.key
    ))
      chunks.push(Buffer.from(chunk))
    equal(
      Buffer.concat(chunks),
      png,
      "Uploads survive independent database connections"
    )
  } finally {
    await reader.close()
  }
  await removeStored(productionAsset!.key)
  equal(
    await mongo!
      .collection("Uploads.files")
      .countDocuments({ filename: productionAsset!.key }),
    0,
    "Deleting upload removes stored file"
  )
  await removeStored(productionAsset!.key)
  equal(
    (
      await newHost.agent.get(
        `/api/rental/host/listings/${create.body.id}/photos`
      )
    ).body.length,
    1,
    "List property photos"
  )
  equal(
    (
      await send(newHost, "patch", `/host/listings/${create.body.id}/photos`, {
        ids: [upload.body.id],
      })
    ).status,
    200,
    "Reorder photos"
  )
  equal(
    (
      await send(newHost, "post", `/host/listings/${create.body.id}/publish`, {
        publish: true,
      })
    ).body.status,
    "PENDING",
    "Host submits listing for moderation"
  )
  equal(
    (
      await send(admin, "post", `/admin/listings/${create.body.id}/decision`, {
        approved: true,
      })
    ).status,
    200,
    "Admin approves listing"
  )
  equal(
    (await request(app).get("/api/rental/search?destination=Noida")).body.total,
    1,
    "Approved stay appears in search"
  )
  equal(
    (
      await send(
        newHost,
        "delete",
        `/host/listings/${create.body.id}/photos/${upload.body.id}`
      )
    ).status,
    200,
    "Delete property photo"
  )
  equal(
    (await c("Property").findOne({ id: create.body.id }))?.status,
    "DRAFT",
    "Removing final photo unpublishes listing"
  )
  equal(
    (
      await send(newHost, "post", "/host/listings", {
        ...base,
        slug: "goa",
        city: "Goa",
        amenities: [],
      })
    ).status,
    400,
    "Outside Delhi NCR rejected"
  )
  equal(
    (
      await send(admin, "patch", "/admin/settings", {
        platformFeeBps: 500,
        taxBps: 0,
        banner: "Welcome to Delhi",
      })
    ).status,
    200,
    "Admin edits settings"
  )
  equal(
    (
      await send(admin, "post", "/admin/coupons", {
        code: "DELHI10",
        percent: 10,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      })
    ).status,
    201,
    "Admin creates coupon"
  )
  equal(
    (
      await send(guest, "post", `/properties/${propertyId}/quote`, {
        ...booking(50),
        coupon: "DELHI10",
      })
    ).body.total,
    671500,
    "Coupon discount uses server pricing"
  )
  equal(
    (await send(admin, "patch", "/admin/coupons/DELHI10", { active: false }))
      .status,
    200,
    "Disable coupon"
  )
  equal(
    (
      await send(guest, "post", `/properties/${propertyId}/quote`, {
        ...booking(50),
        coupon: "DELHI10",
      })
    ).status,
    400,
    "Disabled coupon cannot be redeemed"
  )
  equal(
    (await send(admin, "post", "/admin/categories", { name: "Test category" }))
      .status,
    201,
    "Admin adds category"
  )
  equal(
    (
      await send(admin, "patch", "/admin/categories/Test%20category", {
        active: false,
      })
    ).status,
    200,
    "Admin disables category"
  )
  for (const entity of [
    "users",
    "hosts",
    "listings",
    "bookings",
    "payments",
    "refunds",
    "reviews",
    "reports",
    "categories",
    "coupons",
    "settings",
    "audit",
  ]) {
    const response = await admin.agent.get(`/api/rental/admin/${entity}`)
    equal(response.status, 200, `Admin ${entity} list`)
    assert(!JSON.stringify(response.body).includes(passwordHash))
  }
  const report = (await admin.agent.get("/api/rental/admin/reports")).body
    .items[0]
  equal(
    (
      await send(admin, "patch", `/admin/reports/${report.id}`, {
        status: "RESOLVED",
      })
    ).status,
    200,
    "Admin resolves report"
  )
  equal(
    (await send(admin, "patch", `/admin/users/${adminId}`, { active: false }))
      .status,
    400,
    "Admin cannot disable self"
  )
  // Authentication token consumption and session invalidation.
  // Start this independent scenario with a fresh rate window in the disposable DB.
  await mongo!.collection("RateLimit").deleteMany({
    _id: { $regex: "^mongo-rental-auth:" },
  })
  const freshAgent = request.agent(app),
    freshCsrf = (await freshAgent.get("/api/rental/session")).body.csrf,
    fresh = { agent: freshAgent, csrf: freshCsrf }
  const signup = await send(fresh, "post", "/signup", {
    name: "New User",
    email: "new@test.invalid",
    password: secret,
    consent: true,
    role: "ADMIN",
  })
  equal(signup.status, 201, "Signup creates account")
  equal(
    (
      await send(fresh, "post", "/signup", {
        name: "Duplicate User",
        email: " NEW@test.invalid ",
        password: secret,
        consent: true,
      })
    ).status,
    409,
    "Signup rejects duplicate emails regardless of case or spacing"
  )
  equal(
    (await c("User").findOne({ email: "new@test.invalid" }))?.role,
    "GUEST",
    "Signup cannot assign admin role"
  )
  const token = new URL(signup.body.developmentLink).searchParams.get("token")
  equal(
    (await send(fresh, "post", "/verify-email", { token })).status,
    200,
    "Email verification"
  )
  equal(
    (await send(fresh, "post", "/verify-email", { token })).status,
    400,
    "Verification token is single-use"
  )
  equal(
    (
      await send(fresh, "post", "/login", {
        email: "new@test.invalid",
        password: "Incorrect-password-2026",
      })
    ).status,
    401,
    "Login rejects an incorrect password"
  )
  const freshLogin = await send(fresh, "post", "/login", {
    email: " NEW@test.invalid ",
    password: secret,
  })
  equal(freshLogin.status, 200, "New account can log in with normalized email")
  fresh.csrf = freshLogin.body.csrf
  equal(
    (await fresh.agent.get("/api/rental/session")).body.user.email,
    "new@test.invalid",
    "Login persists in the session"
  )
  equal(
    (await send(fresh, "post", "/logout")).status,
    200,
    "Account can log out"
  )
  const loggedOutSession = (await fresh.agent.get("/api/rental/session")).body
  equal(loggedOutSession.user, null, "Logout clears authenticated session")
  fresh.csrf = loggedOutSession.csrf
  const reset = await send(fresh, "post", "/forgot-password", {
    email: `${guestId}@test.invalid`,
  })
  const resetToken = new URL(reset.body.developmentLink).searchParams.get(
    "token"
  )
  equal(
    (
      await send(fresh, "post", "/reset-password", {
        token: resetToken,
        password: secret + "New",
      })
    ).status,
    200,
    "Password reset"
  )
  equal(
    (await guest.agent.get("/api/rental/session")).body.user,
    null,
    "Password reset invalidates existing sessions"
  )
  equal(
    (
      await send(guest, "post", "/login", {
        email: `${guestId}@test.invalid`,
        password: secret,
      })
    ).status,
    401,
    "Password reset rejects the old password"
  )
  const resetLogin = await send(guest, "post", "/login", {
    email: `${guestId}@test.invalid`,
    password: secret + "New",
  })
  equal(
    resetLogin.status,
    200,
    "Password reset allows login with the new password"
  )
  guest.csrf = resetLogin.body.csrf
  // Provider mock: no real charges are made.
  process.env.RAZORPAY_KEY_ID = "rzp_test_local"
  process.env.RAZORPAY_KEY_SECRET = "local-only-key"
  process.env.RAZORPAY_WEBHOOK_SECRET = "local-only-webhook"
  await c("Property").updateOne(
    { id: propertyId },
    { $set: { bookingMode: "PAYMENT", instantBook: true } }
  )
  const payer = await login(otherId)
  const paidBooking = await send(payer, "post", "/bookings", booking(60))
  equal(paidBooking.status, 201, "Create payment reservation")
  const order = await send(
    payer,
    "post",
    `/bookings/${paidBooking.body.id}/pay`
  )
  equal(order.status, 200, "Server creates payment order")
  equal(
    (await send(payer, "post", `/bookings/${paidBooking.body.id}/pay`)).body
      .orderId,
    order.body.orderId,
    "Payment retry reuses existing order"
  )
  equal(orderCount, 1, "Provider order created only once")
  equal(
    (
      await send(
        payer,
        "post",
        `/bookings/${paidBooking.body.id}/payment-failed`
      )
    ).status,
    200,
    "Failed browser attempt preserves reservation hold"
  )
  const paymentId = "pay_captured_test"
  providerPayments.set(paymentId, {
    id: paymentId,
    order_id: order.body.orderId,
    amount: paidBooking.body.total,
    currency: "INR",
    status: "captured",
  })
  equal(
    (
      await send(payer, "post", `/bookings/${paidBooking.body.id}/verify`, {
        paymentId,
        orderId: order.body.orderId,
        signature: "a".repeat(64),
      })
    ).status,
    400,
    "Forged payment signature rejected"
  )
  const signature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${order.body.orderId}|${paymentId}`)
    .digest("hex")
  equal(
    (
      await send(payer, "post", `/bookings/${paidBooking.body.id}/verify`, {
        paymentId,
        orderId: order.body.orderId,
        signature,
      })
    ).body.paymentStatus,
    "PAID",
    "Captured payment confirms booking"
  )
  equal(
    (await settleMongoPayment(order.body.orderId, paymentId))?.status,
    "CONFIRMED",
    "Repeated settlement is idempotent"
  )
  const event = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: { entity: { id: paymentId, order_id: order.body.orderId } },
      },
    }),
    eventSignature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(event)
      .digest("hex")
  for (let i = 0; i < 2; i++)
    equal(
      (
        await request(app)
          .post("/api/rental/payments/webhook")
          .set("Content-Type", "application/json")
          .set("x-razorpay-signature", eventSignature)
          .set("x-razorpay-event-id", "evt_test")
          .send(event)
      ).status,
      200,
      "Signed webhook/retry accepted"
    )
  equal(
    await c("PaymentEvent").countDocuments({ _id: "evt_test" }),
    1,
    "Webhook deduplicated"
  )
  equal(
    (await send(payer, "post", `/bookings/${paidBooking.body.id}/cancel`))
      .status,
    200,
    "Paid reservation cancellation"
  )
  const refund = await c("Refund").findOne({ bookingId: paidBooking.body.id })
  equal(refund?.amount, paidBooking.body.total, "Eligible full refund recorded")
  equal(
    (await send(admin, "post", `/admin/refunds/${refund!.id}/process`)).status,
    200,
    "Admin processes provider refund"
  )
  equal(
    (await send(admin, "post", `/admin/refunds/${refund!.id}/process`)).status,
    409,
    "Refund cannot be issued twice"
  )
  equal(refundCount, 1, "One provider refund call")
  const late = await send(payer, "post", "/bookings", booking(70))
  const lateOrder = await send(payer, "post", `/bookings/${late.body.id}/pay`)
  await c("Booking").updateOne(
    { id: late.body.id },
    { $set: { expiresAt: new Date(0) } }
  )
  providerPayments.set("pay_late", {
    id: "pay_late",
    order_id: lateOrder.body.orderId,
    amount: late.body.total,
    currency: "INR",
    status: "captured",
  })
  equal(
    (await settleMongoPayment(lateOrder.body.orderId, "pay_late"))?.status,
    "CANCELLED",
    "Late captured payment does not revive expired inventory"
  )
  equal(
    (await c("Refund").findOne({ bookingId: late.body.id }))?.amount,
    late.body.total,
    "Late payment full refund recorded"
  )
  // Reviews are available only after a completed stay.
  await c("Booking").updateOne(
    { id: replacement.body.id },
    { $set: { status: "COMPLETED", checkIn: date(-3), checkOut: date(-1) } }
  )
  const review = await send(
    payer,
    "post",
    `/bookings/${replacement.body.id}/review`,
    { rating: 5, body: "Comfortable stay." }
  )
  equal(review.status, 201, "Guest reviews completed stay")
  equal(
    (
      await send(host, "patch", `/host/reviews/${review.body.id}`, {
        response: "Thank you!",
      })
    ).status,
    200,
    "Host responds to review"
  )
  equal(
    (
      await send(admin, "patch", `/admin/reviews/${review.body.id}`, {
        visible: false,
      })
    ).status,
    200,
    "Admin moderates review"
  )
  equal(
    (await request(app).get("/api/rental/properties/test-delhi-stay")).body
      .reviewCount,
    0,
    "Hidden review excluded from public rating"
  )
  equal(
    (await send(admin, "patch", `/admin/users/${otherId}`, { active: false }))
      .status,
    200,
    "Admin disables user"
  )
  equal(
    (await payer.agent.get("/api/rental/bookings")).status,
    401,
    "Disabled user loses existing session access"
  )
  equal(
    (await admin.agent.get("/api/rental/admin/overview")).status,
    200,
    "Admin overview"
  )
  equal((await send(host, "post", "/logout")).status, 200, "Logout")
  equal(
    (await host.agent.get("/api/rental/host/listings")).status,
    401,
    "Logged out session denied"
  )
  // DigiLocker tests never call the real identity provider or use guest documents.
  await mongo!.collection("RateLimit").deleteMany({ _id: { $regex: "^mongo-rental-auth:" } })
  process.env.DIGILOCKER_REQUIRED = "1"
  equal((await send(guest, "post", "/bookings", { ...booking(90), digilockerVerified: true })).status, 403, "Booking cannot bypass required DigiLocker verification")
  const identityInput = { consent: true, returnTo: "/stays/test-stay" }
  equal((await send(guest, "post", "/digilocker/start", identityInput)).status, 503, "Missing provider credentials fails closed")
  process.env.DIGILOCKER_CLIENT_ID = "test-requester"
  process.env.DIGILOCKER_CLIENT_SECRET = "test-secret"
  equal((await send(guest, "post", "/digilocker/start", { ...identityInput, consent: false })).status, 400, "Explicit identity consent required")
  equal((await send(guest, "post", "/digilocker/start", { ...identityInput, returnTo: "https://attacker.invalid" })).status, 400, "External identity return URL rejected")
  equal((await request(app).post("/api/rental/digilocker/start").set("Origin", origin).send(identityInput)).status, 403, "DigiLocker start requires CSRF")
  let challenge = "", linked = false
  let providerRequests = 0
  const beforeIdentityFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url === "https://api.digitallocker.gov.in/public/oauth2/1/token") {
      providerRequests++
      const body = new URLSearchParams(String(init?.body))
      equal(createHash("sha256").update(body.get("code_verifier") || "").digest("base64url"), challenge, "Token exchange uses original PKCE verifier")
      equal(body.get("redirect_uri"), `${origin}/api/rental/digilocker/callback`, "Token exchange uses registered callback")
      return Response.json({ access_token: "test-access", refresh_token: "test-refresh", token_type: "Bearer", digilockerid: guestId })
    }
    if (url === "https://api.digitallocker.gov.in/public/oauth2/1/user") return Response.json({ digilockerid: guestId, eaadhaar: linked ? "Y" : "N", name: "Private test name", dob: "01012000", gender: "M" })
    if (url === "https://api.digitallocker.gov.in/public/oauth2/1/revoke") return Response.json({})
    return beforeIdentityFetch(input, init)
  }
  async function identityStart() {
    const response = await send(guest, "post", "/digilocker/start", identityInput)
    equal(response.status, 200, "Authenticated DigiLocker start")
    const url = new URL(response.body.url)
    challenge = url.searchParams.get("code_challenge") || ""
    equal(url.searchParams.get("code_challenge_method"), "S256", "DigiLocker uses S256 PKCE")
    equal(url.origin, "https://api.digitallocker.gov.in", "Only official provider authorization URL")
    return url.searchParams.get("state")!
  }
  let identityState = await identityStart()
  equal((await request(app).get(`/api/rental/digilocker/callback?state=${identityState}&code=test`)).headers.location, `${origin}/search?digilocker=expired`, "Callback requires original browser cookie")
  equal(providerRequests, 0, "Invalid browser binding never calls provider")
  await c("IdentityAttempt").updateMany({}, { $set: { expiresAt: new Date(0) } })
  equal((await guest.agent.get(`/api/rental/digilocker/callback?state=${identityState}&code=test`)).headers.location, `${origin}/search?digilocker=expired`, "Expired OAuth state rejected")
  identityState = await identityStart()
  equal((await guest.agent.get(`/api/rental/digilocker/callback?state=${identityState}&error=access_denied`)).headers.location, `${origin}/stays/test-stay?digilocker=cancelled`, "Denied consent returns safely without verification")
  identityState = await identityStart()
  equal((await guest.agent.get(`/api/rental/digilocker/callback?state=${identityState}&code=test`)).headers.location, `${origin}/stays/test-stay?digilocker=not-linked`, "Unlinked DigiLocker account is not marked verified")
  equal(await c("IdentityVerification").countDocuments({ userId: guestId }), 0, "Failed account check creates no verification record")
  linked = true
  identityState = await identityStart()
  equal((await guest.agent.get(`/api/rental/digilocker/callback?state=${identityState}&code=test`)).headers.location, `${origin}/stays/test-stay?digilocker=verified`, "Provider-verified callback returns to selected flat")
  const verification = await c("IdentityVerification").findOne({ userId: guestId })
  equal(Boolean(verification?.verifiedAt), true, "Verification is persisted in MongoDB")
  equal(Object.keys(verification || {}).some(key => ["name", "dob", "gender", "access_token", "refresh_token", "digilockerid"].includes(key)), false, "Identity profile and tokens are not retained")
  equal((await guest.agent.get("/api/rental/session")).body.user.digilockerVerified, true, "Session exposes verified account status")
  equal((await guest.agent.get(`/api/rental/digilocker/callback?state=${identityState}&code=test`)).headers.location, `${origin}/search?digilocker=expired`, "OAuth callback replay rejected")
  equal((await send(guest, "post", "/bookings", booking(90))).status, 201, "Verified guest can request a stay")
  globalThis.fetch = beforeIdentityFetch
  process.env.DIGILOCKER_REQUIRED = "0"
  const secondClient = new MongoClient(process.env.MONGODB_URI!)
  await secondClient.connect()
  equal(
    await secondClient.db().collection("RentalUser").countDocuments(),
    5,
    "Data persisted for another database connection"
  )
  await secondClient.close()
  console.log(
    `\n${checks} MongoDB integration checks passed. No Atlas data or real payments used.`
  )
} finally {
  globalThis.fetch = originalFetch
  // This exact database belongs to this disposable test replica set.
  await mongo?.dropDatabase()
  await disconnect()
}
