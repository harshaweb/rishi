import { config } from "dotenv"
config({ path: ".env.test", override: true, quiet: true })
if (
  !process.env.DATABASE_URL?.includes("/harshaweb_test") ||
  process.env.NODE_ENV !== "test"
)
  throw new Error(
    "Run npm run test:prepare first. Tests never run against the main database."
  )
