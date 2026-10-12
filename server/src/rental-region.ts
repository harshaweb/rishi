import { rentalCities } from "../shared/rental-region.js"
// Only constant application-owned city names are interpolated into SQL.
const cities = [
  ...rentalCities.map((city) => city.toLowerCase()),
  "new delhi",
  "gurgaon",
]
export const rentalRegionSql = (alias = "p") =>
  `lower(trim(${alias ? alias + "." : ""}city)) IN (${cities.map((city) => `'${city}'`).join(",")})`
