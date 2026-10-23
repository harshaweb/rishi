import "../src/database-url.js"
import { pool } from "../src/db.js"
import { rid, rq, rentalTransaction } from "../src/rental-core.js"
import { demoStayPhotos } from "../shared/rental-photos.js"

try {
  const count = await rentalTransaction(async (db) => {
    const properties = await rq(
      `SELECT id,slug FROM "RentalProperty" WHERE demo=true FOR UPDATE`, [], db
    )
    for (const property of properties) {
      await rq(`DELETE FROM "RentalPropertyImage" WHERE "propertyId"=$1`, [property.id], db)
      for (const [position, url] of demoStayPhotos(property.slug).entries()) {
        await rq(
          `INSERT INTO "RentalPropertyImage" (id,"propertyId",url,alt,position) VALUES ($1,$2,$3,$4,$5)`,
          [rid(), property.id, url, `Uploaded demonstration photo ${position + 1}`, position], db
        )
      }
    }
    return properties.length
  })
  console.log(`Updated ${count} demonstration listings with uploaded photos.`)
} finally {
  await pool.end()
}
