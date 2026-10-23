import "../src/database-url.js"
import { isMongo } from "../src/database-url.js"
import { collection, record, transaction, audit } from "../src/mongo-rental-store.js"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { rq, rid, rentalTransaction } from "../src/rental-core.js"
import { disconnect } from "../src/db.js"
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
  if (isMongo) {
    const passwordHash = await bcrypt.hash(password,12)
    await transaction(async session => {
      if(await collection("User").findOne({email},{session})) throw Error("This account already exists.")
      const id=rid()
      await collection("User").insertOne(record({name,email,passwordHash,role:"ADMIN",verified:true,active:true,sessionVersion:0},id),{session})
      await collection("Profile").insertOne(record({userId:id,phone:"",photo:"",notifications:true},id),{session})
      await audit(id,"ADMIN_BOOTSTRAP",id,session)
    })
  } else await rentalTransaction(async (db) => {
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
