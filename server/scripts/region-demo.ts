import "../src/database-url.js"
import { pool } from "../src/db.js"
if (process.env.NODE_ENV === "production")
  throw new Error(
    "This script updates development demonstration listings only."
  )
const cities = [
  ["Goa", "Delhi", 28.6139, 77.209],
  ["Manali", "Gurugram", 28.4595, 77.0266],
  ["Lonavala", "Noida", 28.5355, 77.391],
  ["Bengaluru", "Ghaziabad", 28.6692, 77.4538],
] as const
const client = await pool.connect()
try {
  await client.query("BEGIN")
  let count = 0
  for (const [old, city, latitude, longitude] of cities) {
    const result = await client.query(
      `UPDATE "RentalProperty" SET city=$2, address=$3, latitude=$4,longitude=$5, slug=replace(slug,$6,$7), "updatedAt"=now() WHERE demo=true AND city=$1`,
      [
        old,
        city,
        `Demonstration location in ${city}, Delhi NCR, India`,
        latitude,
        longitude,
        old.toLowerCase() + "-",
        city.toLowerCase() + "-",
      ]
    )
    count += result.rowCount || 0
  }
  await client.query(
    `INSERT INTO "RentalCategory" (name) VALUES ('City stays') ON CONFLICT DO NOTHING`
  )
  await client.query(
    `UPDATE "RentalProperty" SET category='City stays' WHERE demo=true AND category='Beachfront' AND city=ANY($1::text[])`,
    [cities.map((c) => c[1])]
  )
  await client.query("COMMIT")
  console.log(
    `Updated ${count} demonstration listings to Delhi NCR. IDs, photos, reservations and real listings were preserved.`
  )
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  client.release()
  await pool.end()
}
