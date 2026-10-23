import { config } from "dotenv"
config({ path: ".env.test", override: true, quiet: true })
// The regression suite is isolated PostgreSQL even when Atlas is configured locally.
process.env.MONGODB_URL = ""
process.env.MONGODB_URI = ""
if (
  !process.env.DATABASE_URL?.includes("/harshaweb_test") ||
  process.env.NODE_ENV !== "test"
)
  throw new Error(
    "Run npm run test:prepare first. Tests never run against the main database."
  )
