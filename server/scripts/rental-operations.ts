import "../src/database-url.js"
import { isMongo } from "../src/database-url.js"
import { initializeRentals,expireAll } from "../src/mongo-rental-store.js"
import { rentalCategories, rentalAmenities } from "../shared/rentals.js"
import { rq, expireRentals } from "../src/rental-core.js"
import { disconnect } from "../src/db.js"
try {
  if (isMongo) {
    if(process.argv[2] === "catalog") await initializeRentals()
    else if(process.argv[2] === "expire") await expireAll()
    else throw Error("Use catalog or expire.")
    console.log("MongoDB catalog/expiry operation completed.")
  } else if (process.argv[2] === "catalog") {
    for (const name of rentalCategories)
      await rq(
        'INSERT INTO "RentalCategory" (name) VALUES ($1) ON CONFLICT DO NOTHING',
        [name]
      )
    for (const name of rentalAmenities)
      await rq(
        'INSERT INTO "RentalAmenity" (name) VALUES ($1) ON CONFLICT DO NOTHING',
        [name]
      )
    for (const [key, value] of Object.entries({
      platformFeeBps: "500",
      taxBps: "0",
      banner: "",
    }))
      await rq(
        'INSERT INTO "RentalSetting" (key,value) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [key, value]
      )
    console.log(
      "Rental categories, amenities and default settings initialized. No users or demo properties were added."
    )
  } else if (process.argv[2] === "expire") {
    await expireRentals()
    console.log("Expired rental inventory released.")
  } else throw Error("Use catalog or expire.")
} finally {
  await disconnect()
}
