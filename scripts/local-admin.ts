import "dotenv/config"
import { randomBytes } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
if (process.env.LOCAL_POSTGRES !== "1" || process.env.NODE_ENV === "production")
  throw new Error(
    "This helper is for the generated local development environment only. Use admin:create in production."
  )
const db = new PrismaClient()
try {
  const email = "operator@harshaweb.local"
  if (await db.user.findUnique({ where: { email } }))
    console.log(
      "Local operator already exists. Access details are in .data/local-admin.txt."
    )
  else {
    const password = randomBytes(24).toString("base64url")
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: "Local operator",
          role: "ADMIN",
          passwordHash: await bcrypt.hash(password, 12),
        },
      })
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "LOCAL_BOOTSTRAP",
          entity: "users",
          recordId: user.id,
        },
      })
    })
    await mkdir(".data", { recursive: true })
    await writeFile(
      ".data/local-admin.txt",
      `LOCAL DEVELOPMENT ACCESS ONLY\nURL: http://localhost:5173/admin\nEmail: ${email}\nPassword: ${password}\n\nDo not reuse these credentials in production.\n`,
      { flag: "wx", mode: 0o600 }
    )
    console.log(
      "Created a local operator. Access details are saved in ignored .data/local-admin.txt."
    )
  }
} finally {
  await db.$disconnect()
}
