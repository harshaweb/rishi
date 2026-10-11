import "../server/database-url.js"
import { randomBytes } from "node:crypto"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import bcrypt from "bcryptjs"
import { pool } from "../server/db.js"
import { rid, rq, rentalTransaction as tx } from "../server/rental-core.js"
import { rentalCategories, rentalAmenities } from "../shared/rentals.js"
import { demoStayPhotos } from "../shared/rental-photos.js"
if (process.env.NODE_ENV === "production")
  throw new Error(
    "Demonstration seeding is for development/test only. Create real approved hosts and listings for production."
  )
try {
  let hostPassword = randomBytes(18).toString("base64url"),
    guestPassword = randomBytes(18).toString("base64url")
  let credentialsExist = false
  try {
    const saved = await readFile(".data/rental-demo.txt", "utf8")
    hostPassword = saved.match(/Host password: (.+)/)?.[1] || hostPassword
    guestPassword = saved.match(/Guest password: (.+)/)?.[1] || guestPassword
    credentialsExist = true
  } catch {
    /* New local demo credentials. */
  }
  await tx(async (db) => {
    for (const name of rentalCategories)
      await rq(
        `INSERT INTO "RentalCategory" (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [name],
        db
      )
    for (const name of rentalAmenities)
      await rq(
        `INSERT INTO "RentalAmenity" (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [name],
        db
      )
    for (const [key, value] of Object.entries({
      platformFeeBps: "500",
      taxBps: "0",
      banner: "",
      brand: "Omshivraj",
    }))
      await rq(
        `INSERT INTO "RentalSetting" (key,value) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [key, value],
        db
      )
    for (const [email, name, role, password] of [
      ["host@havenly.demo", "Omshivraj demo host", "HOST", hostPassword],
      ["guest@havenly.demo", "Demo traveller", "GUEST", guestPassword],
    ]) {
      await rq(
        `INSERT INTO "RentalUser" (id,name,email,role,verified,"passwordHash") VALUES ($1,$2,$3,$4,true,$5) ON CONFLICT (email) DO NOTHING`,
        [rid(), name, email, role, await bcrypt.hash(password, 12)],
        db
      )
      const [u] = await rq(
        `SELECT id FROM "RentalUser" WHERE email=$1`,
        [email],
        db
      )
      await rq(
        `INSERT INTO "RentalProfile" ("userId") VALUES ($1) ON CONFLICT DO NOTHING`,
        [u.id],
        db
      )
      if (role === "HOST")
        await rq(
          `INSERT INTO "RentalHost" ("userId",bio,status) VALUES ($1,'A demonstration host profile for exploring the marketplace.','APPROVED') ON CONFLICT DO NOTHING`,
          [u.id],
          db
        )
    }
    // Existing administrator credentials are reused only from the trusted local database.
    const admins = await rq(
      `SELECT id,name,email,"passwordHash" FROM "User" WHERE role='ADMIN' AND active`,
      [],
      db
    )
    for (const u of admins) {
      await rq(
        `INSERT INTO "RentalUser" (id,name,email,"passwordHash",role,verified) VALUES ($1,$2,$3,$4,'ADMIN',true) ON CONFLICT (email) DO NOTHING`,
        [u.id, u.name, u.email, u.passwordHash],
        db
      )
      await rq(
        `INSERT INTO "RentalProfile" ("userId") VALUES ($1) ON CONFLICT DO NOTHING`,
        [u.id],
        db
      )
    }
    const [host] = await rq(
      `SELECT id FROM "RentalUser" WHERE email='host@havenly.demo'`,
      [],
      db
    )
    const cities = [
      {
        city: "Delhi",
        lat: 28.6139,
        lng: 77.209,
        types: [
          "Villa",
          "Apartment",
          "House",
          "Villa",
          "Cottage",
          "Apartment",
          "Villa",
          "Homestay",
        ],
        categories: [
          "Pools",
          "City stays",
          "Luxury stays",
          "Villas",
          "Pet-friendly stays",
          "Apartments",
          "Family-friendly stays",
          "Budget stays",
        ],
      },
      {
        city: "Gurugram",
        lat: 28.4595,
        lng: 77.0266,
        types: [
          "Cabin",
          "Cottage",
          "Homestay",
          "Cabin",
          "House",
          "Cottage",
          "Homestay",
          "Villa",
        ],
        categories: [
          "Cabins",
          "Amazing views",
          "Countryside",
          "Unique stays",
          "Family-friendly stays",
          "Pet-friendly stays",
          "Budget stays",
          "Luxury stays",
        ],
      },
      {
        city: "Noida",
        lat: 28.5355,
        lng: 77.391,
        types: [
          "Villa",
          "Cottage",
          "Villa",
          "House",
          "Villa",
          "Cottage",
          "Homestay",
          "Villa",
        ],
        categories: [
          "Pools",
          "Countryside",
          "Luxury stays",
          "Family-friendly stays",
          "Villas",
          "Unique stays",
          "Budget stays",
          "Amazing views",
        ],
      },
      {
        city: "Ghaziabad",
        lat: 28.6692,
        lng: 77.4538,
        types: [
          "Apartment",
          "Apartment",
          "House",
          "Villa",
          "Apartment",
          "Homestay",
          "Apartment",
          "House",
        ],
        categories: [
          "Apartments",
          "Budget stays",
          "Family-friendly stays",
          "Pools",
          "Luxury stays",
          "Pet-friendly stays",
          "Unique stays",
          "Countryside",
        ],
      },
    ]
    const names = [
      "The slow mornings stay",
      "A little corner of calm",
      "The sunlit hideaway",
      "A home away from ordinary",
      "Quiet days, beautiful views",
      "The weekend kind of place",
      "Space to make memories",
      "Your next favourite escape",
    ]
    for (const [ci, c] of cities.entries())
      for (let i = 0; i < 8; i++) {
        const slug = `${c.city.toLowerCase()}-${c.types[i].toLowerCase()}-${i + 1}`
        const id = rid(),
          rate =
            [425000, 285000, 780000, 650000, 340000, 260000, 520000, 195000][
              i
            ] +
            ci * 15000
        const [p] = await rq(
          `INSERT INTO "RentalProperty" (id,slug,"hostId",title,city,address,category,type,description,"nightlyRate","cleaningFee",capacity,bedrooms,beds,bathrooms,latitude,longitude,status,"approvedAt",demo,"bookingMode",cancellation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,65000,$11,$12,$13,$14,$15,$16,'PUBLISHED',now(),true,'HOST_APPROVAL',$17) ON CONFLICT (slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id`,
          [
            id,
            slug,
            host.id,
            names[i],
            c.city,
            `Demonstration location in ${c.city}, India`,
            c.categories[i],
            c.types[i],
            `Make yourself at home in this thoughtfully designed ${c.types[i].toLowerCase()}. Natural textures, generous light and comfortable spaces invite you to slow down. Enjoy a well-equipped kitchen, a peaceful bedroom and room for everyone to find their own corner.\n\nThis is an illustrative demonstration listing with uploaded illustrative photography, not a verified real rental. Development reservations demonstrate the workflow and are not real travel arrangements.`,
            rate,
            2 + (i % 4) * 2,
            1 + (i % 3),
            1 + (i % 3),
            1 + (i % 2),
            c.lat + i * 0.005,
            c.lng + i * 0.006,
            i % 2 ? "MODERATE" : "FLEXIBLE",
          ],
          db
        )
        const uploadedApartment = slug === "delhi-apartment-2"
        if (uploadedApartment)
          await rq(
            `DELETE FROM "RentalPropertyImage" WHERE "propertyId"=$1 AND EXISTS (SELECT 1 FROM "RentalProperty" WHERE id=$1 AND demo=true)`,
            [p.id],
            db
          )
        const existing = await rq(
          `SELECT id FROM "RentalPropertyImage" WHERE "propertyId"=$1 LIMIT 1`,
          [p.id],
          db
        )
        if (!existing.length)
          for (let j = 0; j < 5; j++) {
            await rq(
              `INSERT INTO "RentalPropertyImage" (id,"propertyId",url,alt,position) VALUES ($1,$2,$3,$4,$5)`,
              [
                rid(),
                p.id,
                demoStayPhotos(slug)[j],
                `Uploaded demonstration photo ${j + 1}`,
                j,
              ],
              db
            )
          }
        for (const a of [
          "Wi-Fi",
          "Kitchen",
          "Parking",
          ...(c.categories[i] === "Pools" ? ["Pool"] : []),
          ...(c.categories[i] === "Pet-friendly stays" ? ["Pets allowed"] : []),
          ...(ci !== 1 ? ["Air conditioning"] : []),
        ])
          await rq(
            `INSERT INTO "RentalPropertyAmenity" ("propertyId",amenity) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [p.id, a],
            db
          )
      }
  })
  if (!credentialsExist) {
    await mkdir(".data", { recursive: true })
    await writeFile(
      ".data/rental-demo.txt",
      `DEVELOPMENT ACCOUNTS ONLY\nHost email: host@havenly.demo\nHost password: ${hostPassword}\nGuest email: guest@havenly.demo\nGuest password: ${guestPassword}\nAdministrator: reuse the local operator credentials in .data/local-admin.txt.\n`,
      { flag: "wx", mode: 0o600 }
    )
  }
  console.log(
    "Seeded 32 labelled demonstration properties. Local demo account details are in ignored .data/rental-demo.txt. No reviews, payments or transactions were fabricated."
  )
} finally {
  await pool.end()
}
