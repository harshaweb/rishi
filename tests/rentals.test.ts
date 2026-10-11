import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import request from "supertest"
import bcrypt from "bcryptjs"
import { readFile } from "node:fs/promises"
import { randomUUID, createHmac } from "node:crypto"
import { app, apiError } from "../server/app"
import { disconnect } from "../server/db"
import {
  calculateRentalPrice,
  rentalDates,
  verifyRentalSignature,
  rentalRefundAmount,
  rq,
} from "../server/rental-core"
import { settleRentalPayment } from "../server/rental-api"
app.use(apiError)
const ids = {
  host: randomUUID(),
  guest: randomUUID(),
  other: randomUUID(),
  admin: randomUUID(),
  property: randomUUID(),
}
const secret = "Test-Only-Password-Long-123",
  origin = "http://localhost:5173"
const date = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
type Client = { agent: ReturnType<typeof request.agent>; csrf: string }
let host: Client, guest: Client, other: Client, admin: Client
async function login(id: string): Promise<Client> {
  const agent = request.agent(app)
  let csrf = (await agent.get("/api/rental/session")).body.csrf
  const r = await agent
    .post("/api/rental/login")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send({ email: `${id}@test.invalid`, password: secret })
  expect(r.status, r.body.error).toBe(200)
  csrf = r.body.csrf
  return { agent, csrf }
}
function post(c: Client, path: string, data: unknown = {}) {
  return c.agent
    .post("/api/rental" + path)
    .set("Origin", origin)
    .set("X-CSRF-Token", c.csrf)
    .send(data)
}
function patch(c: Client, path: string, data: unknown) {
  return c.agent
    .patch("/api/rental" + path)
    .set("Origin", origin)
    .set("X-CSRF-Token", c.csrf)
    .send(data)
}
function booking(days: number, key = randomUUID()) {
  return {
    propertyId: ids.property,
    checkIn: date(days),
    checkOut: date(days + 2),
    guests: 2,
    idempotencyKey: key,
    total: 1,
    role: "ADMIN",
  }
}
beforeAll(async () => {
  await rq(`TRUNCATE "RateLimit"`)
  await rq(`TRUNCATE "RentalUser" CASCADE`)
  await rq(
    `INSERT INTO "RentalCategory" (name) VALUES ('City stays') ON CONFLICT DO NOTHING`
  )
  await rq(
    `INSERT INTO "RentalAmenity" (name) VALUES ('Wi-Fi') ON CONFLICT DO NOTHING`
  )
  await rq(
    `INSERT INTO "RentalSetting" (key,value) VALUES ('platformFeeBps','500'),('taxBps','0') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`
  )
  const hash = await bcrypt.hash(secret, 4)
  for (const [role, id] of Object.entries(ids).filter(
    ([k]) => k !== "property"
  )) {
    await rq(
      `INSERT INTO "RentalUser" (id,name,email,"passwordHash",role,verified) VALUES ($1,$2,$3,$4,$5,true)`,
      [
        id,
        role,
        `${id}@test.invalid`,
        hash,
        role === "host" ? "HOST" : role === "admin" ? "ADMIN" : "GUEST",
      ]
    )
    await rq(`INSERT INTO "RentalProfile" ("userId") VALUES ($1)`, [id])
  }
  await rq(
    `INSERT INTO "RentalProperty" (id,slug,"hostId",title,city,address,category,type,description,"nightlyRate","cleaningFee",capacity,bedrooms,beds,bathrooms,status,"approvedAt",demo) VALUES ($1,'test-delhi-stay',$2,'Integration stay','Delhi','Test address','City stays','Villa','Test property',200000,10000,4,2,2,2,'PUBLISHED',now(),true)`,
    [ids.property, ids.host]
  )
  await rq(
    `INSERT INTO "RentalPropertyImage" (id,"propertyId",url) VALUES ($1,$2,'/stays/stay-1.jpg')`,
    [randomUUID(), ids.property]
  )
  await rq(
    `INSERT INTO "RentalPropertyAmenity" ("propertyId",amenity) VALUES ($1,'Wi-Fi')`,
    [ids.property]
  )
  host = await login(ids.host)
  guest = await login(ids.guest)
  other = await login(ids.other)
  admin = await login(ids.admin)
})
beforeEach(async () => {
  await rq(`DELETE FROM "RateLimit" WHERE key LIKE 'rental-%'`)
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await rq(`TRUNCATE "RentalUser" CASCADE`)
  await disconnect()
})
describe("Rental pricing and integrity", () => {
  it("calculates all money in paise with server fees, discount and tax", () => {
    expect(calculateRentalPrice(200000, 2, 10000, 500, 0)).toMatchObject({
      nightlySubtotal: 400000,
      platformFee: 20000,
      total: 430000,
    })
    expect(calculateRentalPrice(100000, 2, 0, 500, 1000, 10).total).toBe(207900)
    expect(() => calculateRentalPrice(-1, 2, 0, 500, 0)).toThrow()
  })
  it("rejects invalid dates and permits checkout-exclusive adjacent nights", () => {
    expect(rentalDates(date(10), date(12))).toBe(2)
    expect(() => rentalDates("2026-02-30", "2026-03-05")).toThrow()
    expect(() => rentalDates(date(12), date(10))).toThrow()
    expect(() => rentalDates(date(10), date(101))).toThrow()
  })
  it("requires exact signed order and webhook bytes with configured secrets", () => {
    const h = createHmac("sha256", "secret")
      .update("order|payment")
      .digest("hex")
    expect(verifyRentalSignature("order|payment", h, "secret")).toBe(true)
    expect(verifyRentalSignature("tampered", h, "secret")).toBe(false)
    expect(verifyRentalSignature("order|payment", h, "")).toBe(false)
  })
  it("calculates cancellation refunds at policy boundaries", () => {
    expect(rentalRefundAmount(10000, "FLEXIBLE", date(10))).toBe(10000)
    expect(rentalRefundAmount(10000, "STRICT", date(2))).toBe(0)
    expect(rentalRefundAmount(10000, "STRICT", date(10))).toBe(5000)
  })
})
describe("Rental account, ownership and moderation", () => {
  it("protects private APIs and rejects mutations without CSRF", async () => {
    expect((await request(app).get("/api/rental/bookings")).status).toBe(401)
    expect(
      (await guest.agent.post("/api/rental/wishlists").send({ name: "x" }))
        .status
    ).toBe(403)
    expect((await guest.agent.get("/api/rental/admin/users")).status).toBe(403)
    expect((await guest.agent.get("/api/admin/users")).status).toBe(401)
  })
  it("registers as guest, verifies a one-time email token and rejects wrong password", async () => {
    const c = request.agent(app),
      csrf = (await c.get("/api/rental/session")).body.csrf
    const r = await c
      .post("/api/rental/signup")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({
        name: "New Guest",
        email: "new-rental@test.invalid",
        password: secret,
        consent: true,
        role: "ADMIN",
      })
    expect(r.status, r.body.error).toBe(201)
    expect(
      (
        await rq(
          `SELECT role,verified FROM "RentalUser" WHERE email='new-rental@test.invalid'`
        )
      )[0]
    ).toMatchObject({ role: "GUEST", verified: false })
    const token = new URL(r.body.developmentLink).searchParams.get("token")
    expect(
      (
        await c
          .post("/api/rental/verify-email")
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send({ token })
      ).status
    ).toBe(200)
    expect(
      (
        await c
          .post("/api/rental/verify-email")
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send({ token })
      ).status
    ).toBe(400)
    expect(
      (
        await c
          .post("/api/rental/login")
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send({ email: "new-rental@test.invalid", password: "wrong" })
      ).status
    ).toBe(401)
  })
  it("stores a host application without granting host powers", async () => {
    expect(
      (
        await post(other, "/host/onboard", {
          bio: "I would like to share my home.",
        })
      ).status
    ).toBe(200)
    expect((await other.agent.get("/api/rental/host/listings")).status).toBe(
      403
    )
    expect(
      (
        await post(admin, `/admin/hosts/${ids.other}/decision`, {
          approved: true,
        })
      ).status
    ).toBe(200)
    expect((await other.agent.get("/api/rental/host/listings")).status).toBe(
      200
    )
    await post(admin, `/admin/hosts/${ids.other}/decision`, { approved: false })
  })
  it("creates drafts, protects ownership and resets approval on edit", async () => {
    const d = {
      title: "Host draft",
      slug: "host-draft",
      city: "Delhi",
      address: "test address",
      category: "City stays",
      type: "Villa",
      description: "A test stay",
      nightlyRate: 100000,
      capacity: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      latitude: 15,
      longitude: 73,
      amenities: ["Wi-Fi"],
    }
    const r = await post(host, "/host/listings", d)
    expect(r.status, r.body.error).toBe(201)
    expect(
      (await patch(other, `/host/listings/${r.body.id}`, { title: "Stolen" }))
        .status
    ).toBe(403)
    expect(
      (
        await post(host, `/host/listings/${r.body.id}/publish`, {
          publish: true,
        })
      ).status
    ).toBe(400)
    expect(
      (
        await patch(host, `/host/listings/${ids.property}`, {
          amenities: ["Wi-Fi"],
        })
      ).status
    ).toBe(200)
    expect(
      (
        await rq(
          `SELECT status,"approvedAt" FROM "RentalProperty" WHERE id=$1`,
          [ids.property]
        )
      )[0]
    ).toMatchObject({ status: "DRAFT", approvedAt: null })
    expect(
      (
        await post(admin, `/admin/listings/${ids.property}/decision`, {
          approved: true,
        })
      ).status
    ).toBe(200)
  })
  it("combines destination, price, capacity and amenities filters", async () => {
    const a = await request(app).get(
      "/api/rental/search?destination=Delhi&minPrice=1500&maxPrice=2500&guests=4&amenities=Wi-Fi"
    )
    expect(a.status, a.body.error).toBe(200)
    expect(a.body.items.map((p: { id: string }) => p.id)).toContain(
      ids.property
    )
    expect(
      (await request(app).get("/api/rental/search?destination=Delhi&guests=5"))
        .body.total
    ).toBe(0)
    expect(
      (await request(app).get(`/api/rental/search?checkIn=${date(20)}`)).status
    ).toBe(400)
  })
  it("limits public discovery, booking and publishing to Delhi NCR", async () => {
    expect(
      (
        await request(app).get("/api/rental/search?destination=New%20Delhi")
      ).body.items.map((p: { id: string }) => p.id)
    ).toContain(ids.property)
    expect(
      (
        await request(app).get("/api/rental/search?destination=Delhi%20NCR")
      ).body.items.map((p: { id: string }) => p.id)
    ).toContain(ids.property)
    expect(
      (await patch(host, `/host/listings/${ids.property}`, { city: "Mumbai" }))
        .status
    ).toBe(400)
    await rq(`UPDATE "RentalProperty" SET city='Mumbai' WHERE id=$1`, [
      ids.property,
    ])
    try {
      const search = await request(app).get("/api/rental/search")
      expect(search.body.items.map((p: { id: string }) => p.id)).not.toContain(
        ids.property
      )
      expect(
        (await request(app).get("/api/rental/destinations?q=Mumbai")).body
      ).toEqual([])
      expect(
        (await request(app).get(`/api/rental/properties/${ids.property}`))
          .status
      ).toBe(404)
      expect(
        (await post(guest, `/properties/${ids.property}/quote`, booking(250)))
          .status
      ).toBe(404)
      expect((await post(guest, "/bookings", booking(250))).status).toBe(404)
      expect(
        (
          await post(host, `/host/listings/${ids.property}/publish`, {
            publish: true,
          })
        ).status
      ).toBe(400)
      expect(
        (
          await post(admin, `/admin/listings/${ids.property}/decision`, {
            approved: true,
          })
        ).status
      ).toBe(400)
    } finally {
      await rq(`UPDATE "RentalProperty" SET city='Delhi' WHERE id=$1`, [
        ids.property,
      ])
    }
  })
  it("persists wishlists and prevents cross-account writes", async () => {
    const r = await post(guest, "/wishlists", { name: "Delhi trip" })
    expect(r.status).toBe(201)
    expect(
      (
        await post(guest, `/wishlists/${r.body.id}/items`, {
          propertyId: ids.property,
        })
      ).status
    ).toBe(200)
    expect(
      (
        await post(other, `/wishlists/${r.body.id}/items`, {
          propertyId: ids.property,
        })
      ).status
    ).toBe(404)
    expect(
      (await guest.agent.get("/api/rental/wishlists")).body.lists[0].propertyIds
    ).toContain(ids.property)
    expect(
      (await patch(guest, `/wishlists/${r.body.id}`, { name: "Renamed" }))
        .status
    ).toBe(200)
    expect(
      (
        await guest.agent
          .delete(`/api/rental/wishlists/${r.body.id}`)
          .set("Origin", origin)
          .set("X-CSRF-Token", guest.csrf)
      ).status
    ).toBe(200)
  })
  it("keeps private host-guest messages inaccessible to outsiders", async () => {
    const r = await post(guest, "/conversations", {
      propertyId: ids.property,
      body: "Is parking available?",
    })
    expect(r.status).toBe(201)
    expect(
      (await host.agent.get(`/api/rental/conversations/${r.body.id}`)).body[0]
        .body
    ).toBe("Is parking available?")
    expect(
      (await other.agent.get(`/api/rental/conversations/${r.body.id}`)).status
    ).toBe(404)
    expect(
      (
        await post(host, `/conversations/${r.body.id}`, {
          body: "Yes, a space is included.",
        })
      ).status
    ).toBe(201)
  })
})
describe("Rental reservations and provider verification", () => {
  it("prevents concurrent overlapping bookings, ignores client prices and replays idempotently", async () => {
    const d = booking(30)
    const results = await Promise.all([
      post(guest, "/bookings", d),
      post(other, "/bookings", booking(30)),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    const winner = results[0].status === 201 ? guest : other,
      b = results.find((r) => r.status === 201)!.body
    expect(b.total).toBe(430000)
    expect(
      (
        await rq(`SELECT * FROM "RentalBookingNight" WHERE "bookingId"=$1`, [
          b.id,
        ])
      ).length
    ).toBe(2)
    if (winner === guest)
      expect((await post(guest, "/bookings", d)).body.id).toBe(b.id)
    expect((await post(host, `/host/reservations/${b.id}/accept`)).status).toBe(
      200
    )
    expect(
      (
        await rq(
          `SELECT status,"paymentStatus" FROM "RentalBooking" WHERE id=$1`,
          [b.id]
        )
      )[0]
    ).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAY_AT_PROPERTY" })
    expect(
      (
        await post(winner, `/bookings/${b.id}/review`, {
          rating: 5,
          body: "Too soon",
        })
      ).status
    ).toBe(403)
    expect(
      (
        await post(winner, `/bookings/${b.id}/cancel`, {
          reason: "QA cancellation",
        })
      ).status
    ).toBe(200)
    expect(
      (
        await rq(`SELECT "cancelReason" FROM "RentalBooking" WHERE id=$1`, [
          b.id,
        ])
      )[0].cancelReason
    ).toContain("QA cancellation")
    expect(
      (
        await rq(`SELECT * FROM "RentalBookingNight" WHERE "bookingId"=$1`, [
          b.id,
        ])
      ).length
    ).toBe(0)
  })
  it("releases expired holds and permits adjacent stays", async () => {
    const a = await post(guest, "/bookings", booking(40))
    expect(a.status).toBe(201)
    expect((await post(other, "/bookings", booking(42))).status).toBe(201)
    await rq(
      `UPDATE "RentalBooking" SET "expiresAt"=now()-interval '1 minute' WHERE id=$1`,
      [a.body.id]
    )
    expect((await post(other, "/bookings", booking(40))).status).toBe(201)
  })
  it("excludes host-blocked nights from search and booking", async () => {
    expect(
      (
        await post(host, `/host/listings/${ids.property}/blocks`, {
          start: date(50),
          end: date(52),
          reason: "Maintenance",
        })
      ).status
    ).toBe(201)
    expect((await post(guest, "/bookings", booking(50))).status).toBe(409)
    expect(
      (
        await request(app).get(
          `/api/rental/search?checkIn=${date(50)}&checkOut=${date(52)}`
        )
      ).body.total
    ).toBe(0)
  })
  it("does not create a payable reservation without provider credentials", async () => {
    await rq(
      `UPDATE "RentalProperty" SET "bookingMode"='PAYMENT' WHERE id=$1`,
      [ids.property]
    )
    const old = process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_ID
    expect((await post(guest, "/bookings", booking(60))).status).toBe(503)
    if (old) process.env.RAZORPAY_KEY_ID = old
    await rq(
      `UPDATE "RentalProperty" SET "bookingMode"='HOST_APPROVAL' WHERE id=$1`,
      [ids.property]
    )
  })
  it("verifies captured amounts server-side, confirms once, and records refunds", async () => {
    process.env.RAZORPAY_KEY_ID = "test"
    process.env.RAZORPAY_KEY_SECRET = "test-secret"
    await rq(
      `UPDATE "RentalProperty" SET "bookingMode"='PAYMENT' WHERE id=$1`,
      [ids.property]
    )
    const b = (await post(guest, "/bookings", booking(65))).body
    const order = `order_${randomUUID()}`,
      payment = `pay_${randomUUID()}`
    const orderFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: order, amount: b.total, currency: "INR" }),
          { status: 200 }
        )
    )
    vi.stubGlobal("fetch", orderFetch)
    const attempts = await Promise.all([
      post(guest, `/bookings/${b.id}/pay`),
      post(guest, `/bookings/${b.id}/pay`),
    ])
    expect(attempts.map((r) => r.status)).toEqual([200, 200])
    expect(orderFetch).toHaveBeenCalledTimes(1)
    await rq(
      `UPDATE "RentalProperty" SET "bookingMode"='HOST_APPROVAL',cancellation='STRICT' WHERE id=$1`,
      [ids.property]
    )
    expect((await post(host, `/host/reservations/${b.id}/accept`)).status).toBe(
      409
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: payment,
              order_id: order,
              status: "captured",
              amount: b.total + 1,
              currency: "INR",
            }),
            { status: 200 }
          )
      )
    )
    await expect(settleRentalPayment(order, payment)).rejects.toThrow()
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: payment,
              order_id: order,
              status: "captured",
              amount: b.total,
              currency: "INR",
            }),
            { status: 200 }
          )
      )
    )
    const signature = createHmac("sha256", "test-secret")
      .update(`${order}|${payment}`)
      .digest("hex")
    expect(
      (
        await post(guest, `/bookings/${b.id}/verify`, {
          orderId: order,
          paymentId: payment,
          signature: "0".repeat(64),
        })
      ).status
    ).toBe(400)
    expect(
      (
        await post(guest, `/bookings/${b.id}/verify`, {
          orderId: order,
          paymentId: payment,
          signature,
        })
      ).status
    ).toBe(200)
    await settleRentalPayment(order, payment)
    expect(
      (
        await rq(
          `SELECT status,"paymentStatus" FROM "RentalBooking" WHERE id=$1`,
          [b.id]
        )
      )[0]
    ).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" })
    await post(guest, `/bookings/${b.id}/cancel`)
    expect(
      (
        await rq(
          `SELECT amount,status FROM "RentalRefund" WHERE "bookingId"=$1`,
          [b.id]
        )
      )[0]
    ).toMatchObject({ amount: b.total, status: "PENDING" })
    vi.unstubAllGlobals()
    delete process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_SECRET
  })
  it("rejects forged webhooks and deduplicates signed provider events", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-test"
    const body = JSON.stringify({ event: "test.event" }),
      signature = createHmac("sha256", "webhook-test")
        .update(body)
        .digest("hex")
    expect(
      (
        await request(app)
          .post("/api/rental/payments/webhook")
          .set("Content-Type", "application/json")
          .set("X-Razorpay-Signature", "bad")
          .send(body)
      ).status
    ).toBe(400)
    const id = randomUUID()
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(app)
            .post("/api/rental/payments/webhook")
            .set("Content-Type", "application/json")
            .set("X-Razorpay-Signature", signature)
            .set("X-Razorpay-Event-Id", id)
            .send(body)
        ).status
      ).toBe(200)
    expect(
      (await rq(`SELECT * FROM "RentalPaymentEvent" WHERE id=$1`, [id])).length
    ).toBe(1)
    delete process.env.RAZORPAY_WEBHOOK_SECRET
  })
  it("permits exactly one review after a completed eligible stay", async () => {
    const b = (await post(guest, "/bookings", booking(75))).body
    await rq(
      `UPDATE "RentalBooking" SET status='COMPLETED',"checkIn"=CURRENT_DATE-3,"checkOut"=CURRENT_DATE-1 WHERE id=$1`,
      [b.id]
    )
    expect(
      (
        await post(guest, `/bookings/${b.id}/review`, {
          rating: 5,
          body: "A completed test stay.",
        })
      ).status
    ).toBe(201)
    const again = await post(guest, `/bookings/${b.id}/review`, {
      rating: 5,
      body: "Duplicate",
    })
    expect(again.status).toBe(409)
  })
})
describe("Account recovery, uploads and late capture", () => {
  it("resets a password once and revokes existing sessions", async () => {
    const c = request.agent(app),
      csrf = (await c.get("/api/rental/session")).body.csrf
    const login = await c
      .post("/api/rental/login")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ email: "new-rental@test.invalid", password: secret })
    expect(login.status).toBe(200)
    const oldSession = login.body.csrf
    const reset = await post(guest, "/forgot-password", {
      email: "new-rental@test.invalid",
    })
    const token = new URL(reset.body.developmentLink).searchParams.get("token")
    expect(
      (
        await post(guest, "/reset-password", {
          token,
          password: "A-New-Test-Password-1234",
        })
      ).status
    ).toBe(200)
    expect((await c.get("/api/rental/session")).body.user).toBeNull()
    expect(
      (
        await post(guest, "/reset-password", {
          token,
          password: "A-New-Test-Password-1234",
        })
      ).status
    ).toBe(400)
    expect(
      (
        await c
          .patch("/api/rental/profile")
          .set("Origin", origin)
          .set("X-CSRF-Token", oldSession)
          .send({ name: "x", phone: "", notifications: true })
      ).status
    ).toBe(401)
  })
  it("validates uploaded binary types, reorders photos and removes their listing association", async () => {
    const [draft] = await rq(
      `SELECT id FROM "RentalProperty" WHERE slug='host-draft'`
    )
    const invalid = await host.agent
      .post(`/api/rental/host/listings/${draft.id}/photos`)
      .set("Origin", origin)
      .set("X-CSRF-Token", host.csrf)
      .attach("image", Buffer.from("not a photograph"), {
        filename: "bad.jpg",
        contentType: "image/jpeg",
      })
    expect(invalid.status).toBe(400)
    const valid = await host.agent
      .post(`/api/rental/host/listings/${draft.id}/photos`)
      .set("Origin", origin)
      .set("X-CSRF-Token", host.csrf)
      .attach("image", await readFile("public/stays/stay-1.jpg"), {
        filename: "stay.jpg",
        contentType: "image/jpeg",
      })
    expect(valid.status, valid.body.error).toBe(201)
    expect(
      (
        await patch(host, `/host/listings/${draft.id}/photos`, {
          ids: [valid.body.id],
        })
      ).status
    ).toBe(200)
    expect(
      (
        await host.agent
          .delete(
            `/api/rental/host/listings/${draft.id}/photos/${valid.body.id}`
          )
          .set("Origin", origin)
          .set("X-CSRF-Token", host.csrf)
      ).status
    ).toBe(200)
  })
  it("refunds a captured payment arriving after expiry without confirming unavailable inventory", async () => {
    process.env.RAZORPAY_KEY_ID = "test"
    process.env.RAZORPAY_KEY_SECRET = "test-secret"
    await rq(
      `UPDATE "RentalProperty" SET "bookingMode"='PAYMENT' WHERE id=$1`,
      [ids.property]
    )
    const b = (await post(guest, "/bookings", booking(80))).body
    const order = `late_${randomUUID()}`,
      payment = `pay_${randomUUID()}`
    await rq(
      `INSERT INTO "RentalPayment" (id,"bookingId","orderId",amount) VALUES ($1,$2,$3,$4)`,
      [randomUUID(), b.id, order, b.total]
    )
    await rq(
      `UPDATE "RentalBooking" SET "expiresAt"=now()-interval '1 minute' WHERE id=$1`,
      [b.id]
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: payment,
              order_id: order,
              status: "captured",
              amount: b.total,
              currency: "INR",
            }),
            { status: 200 }
          )
      )
    )
    const result = await settleRentalPayment(order, payment)
    expect(result.status).toBe("CANCELLED")
    expect(
      (
        await rq(`SELECT amount FROM "RentalRefund" WHERE "bookingId"=$1`, [
          b.id,
        ])
      )[0].amount
    ).toBe(b.total)
    expect(
      (
        await rq(`SELECT * FROM "RentalBookingNight" WHERE "bookingId"=$1`, [
          b.id,
        ])
      ).length
    ).toBe(0)
    vi.unstubAllGlobals()
    delete process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_SECRET
  })
})

describe("Administrator database operations", () => {
  it("loads every database section without exposing password hashes", async () => {
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
      const result = await admin.agent.get(`/api/rental/admin/${entity}`)
      expect(result.status, `${entity}: ${result.body.error}`).toBe(200)
      expect(Array.isArray(result.body.items)).toBe(true)
      expect(Number.isInteger(result.body.total)).toBe(true)
      expect(JSON.stringify(result.body)).not.toContain("passwordHash")
    }
    expect((await admin.agent.get("/api/rental/admin/overview")).status).toBe(
      200
    )
  })
  it("searches accounts by email and rejects invalid pages", async () => {
    const result = await admin.agent
      .get("/api/rental/admin/users")
      .query({ search: `${ids.guest}@test.invalid` })
    expect(result.status).toBe(200)
    expect(result.body.items.map((row: { id: string }) => row.id)).toEqual([
      ids.guest,
    ])
    expect(
      (await admin.agent.get("/api/rental/admin/users?page=0")).status
    ).toBe(400)
  })
  it("persists settings atomically and refuses invalid fees", async () => {
    const previous = await rq(
      `SELECT key,value FROM "RentalSetting" WHERE key IN ('platformFeeBps','taxBps','banner')`
    )
    try {
      expect(
        (
          await patch(admin, "/admin/settings", {
            platformFeeBps: 650,
            taxBps: 100,
            banner: "Database persistence test",
          })
        ).status
      ).toBe(200)
      const result = await admin.agent.get("/api/rental/admin/settings")
      expect(result.body.items).toEqual(
        expect.arrayContaining([
          { key: "banner", value: "Database persistence test" },
        ])
      )
      expect(
        (
          await patch(admin, "/admin/settings", {
            platformFeeBps: -1,
            taxBps: 0,
            banner: "Invalid",
          })
        ).status
      ).toBe(400)
      expect(
        (await rq(`SELECT value FROM "RentalSetting" WHERE key='banner'`))[0]
          .value
      ).toBe("Database persistence test")
    } finally {
      await rq(
        `DELETE FROM "RentalSetting" WHERE key IN ('platformFeeBps','taxBps','banner')`
      )
      for (const row of previous)
        await rq(`INSERT INTO "RentalSetting" (key,value) VALUES ($1,$2)`, [
          row.key,
          row.value,
        ])
    }
  })
  it("saves categories and coupons, disables them, and writes audit records", async () => {
    const name = `Admin category ${randomUUID()}`
    const code = `ADMIN${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`
    try {
      expect((await post(admin, "/admin/categories", { name })).status).toBe(
        201
      )
      expect(
        (
          await patch(admin, `/admin/categories/${encodeURIComponent(name)}`, {
            active: false,
          })
        ).status
      ).toBe(200)
      expect(
        (
          await rq(`SELECT active FROM "RentalCategory" WHERE name=$1`, [name])
        )[0].active
      ).toBe(false)
      expect(
        (
          await post(admin, "/admin/coupons", {
            code,
            percent: 15,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          })
        ).status
      ).toBe(201)
      expect(
        (await patch(admin, `/admin/coupons/${code}`, { active: false })).status
      ).toBe(200)
      expect(
        (
          await rq(`SELECT active,percent FROM "RentalCoupon" WHERE code=$1`, [
            code,
          ])
        )[0]
      ).toMatchObject({ active: false, percent: 15 })
      expect(
        (
          await rq(`SELECT action FROM "RentalAudit" WHERE "entityId"=$1`, [
            code,
          ])
        ).map((row) => row.action)
      ).toEqual(expect.arrayContaining(["COUPON_SAVED", "COUPON_UPDATED"]))
      expect(
        (await patch(guest, `/admin/coupons/${code}`, { active: true })).status
      ).toBe(403)
    } finally {
      await rq(`DELETE FROM "RentalCoupon" WHERE code=$1`, [code])
      await rq(`DELETE FROM "RentalCategory" WHERE name=$1`, [name])
    }
  })
  it("returns missing-record errors and protects the operator account", async () => {
    for (const [entity, data] of [
      ["users", { active: false }],
      ["reviews", { visible: false }],
      ["reports", { status: "RESOLVED" }],
      ["categories", { active: false }],
      ["coupons", { active: false }],
    ] as const) {
      expect(
        (await patch(admin, `/admin/${entity}/${randomUUID()}`, data)).status
      ).toBe(404)
    }
    expect(
      (await patch(admin, `/admin/users/${ids.admin}`, { active: false }))
        .status
    ).toBe(400)
    expect(
      (await patch(admin, `/admin/users/${ids.admin}`, { role: "GUEST" }))
        .status
    ).toBe(400)
    expect((await admin.agent.get("/api/rental/admin/users")).status).toBe(200)
  })
})
