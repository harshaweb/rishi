import "../server/database-url.js"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { rq, rid, rentalTransaction } from "../server/rental-core.js"
import { disconnect } from "../server/db.js"
const data = z
  .object({
    ADMIN_NAME: z.string().trim().min(1).max(100),
    ADMIN_EMAIL: z
      .string()
      .email()
      .transform((s) => s.toLowerCase()),
    ADMIN_PASSWORD: z.string().min(12).max(72),
  })
  .safeParse(process.env)
if (!data.success)
  throw Error(
    "Supply ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (12–72 characters) through your secret manager or process environment. No default production password is provided."
  )
try {
  const {
    ADMIN_NAME: name,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
  } = data.data
  await rentalTransaction(async (db) => {
    if (
      (await rq('SELECT id FROM "RentalUser" WHERE email=$1', [email], db))
        .length
    )
      throw Error(
        "This account already exists. Use an existing administrator to change its role."
      )
    const id = rid()
    await rq(
      `INSERT INTO "RentalUser" (id,name,email,"passwordHash",role,verified) VALUES ($1,$2,$3,$4,'ADMIN',true)`,
      [id, name, email, await bcrypt.hash(password, 12)],
      db
    )
    await rq('INSERT INTO "RentalProfile" ("userId") VALUES ($1)', [id], db)
    await rq(
      `INSERT INTO "RentalAudit" (id,"userId",action,"entityId") VALUES ($1,$2,'ADMIN_BOOTSTRAP',$2)`,
      [rid(), id],
      db
    )
  })
  console.log(
    "Rental administrator created. Sign in at /login, then open /admin. Remove bootstrap environment variables after use."
  )
} finally {
  await disconnect()
}
