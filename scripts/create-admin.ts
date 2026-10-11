import "dotenv/config"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { userSchema } from "../server/validation.js"
const rl = createInterface({ input: stdin, output: stdout })
const db = new PrismaClient()
try {
  const email =
    process.env.ADMIN_EMAIL || (await rl.question("Administrator email: "))
  const name =
    process.env.ADMIN_NAME || (await rl.question("Administrator name: "))
  // Password input is hidden; environment injection is available for non-interactive provisioning.
  let password = process.env.ADMIN_PASSWORD
  if (!password) {
    if (!stdin.isTTY)
      throw new Error(
        "Provide ADMIN_PASSWORD through your secret manager for non-interactive bootstrap."
      )
    rl.close()
    stdout.write("Administrator password (input hidden): ")
    stdin.setRawMode(true)
    stdin.resume()
    password = await new Promise<string>((resolve, reject) => {
      let value = ""
      const handler = (chunk: Buffer) => {
        const text = chunk.toString()
        if (text === "\u0003") {
          stdin.off("data", handler)
          reject(new Error("Cancelled"))
        } else if (text.includes("\r") || text.includes("\n")) {
          stdin.off("data", handler)
          resolve(value)
        } else if (text === "\u007f" || text === "\b")
          value = value.slice(0, -1)
        else value += text
      }
      stdin.on("data", handler)
    })
    stdin.setRawMode(false)
    stdin.pause()
    stdout.write("\n")
  }
  const data = userSchema.parse({
    email,
    name,
    password,
    role: "ADMIN",
    active: true,
  })
  const { password: secret, ...fields } = data
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { ...fields, passwordHash: await bcrypt.hash(secret!, 12) },
    })
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "BOOTSTRAP",
        entity: "users",
        recordId: user.id,
      },
    })
  })
  console.log(
    "Administrator created. Sign in at /admin. No public registration is available."
  )
} finally {
  if (stdin.isTTY) stdin.setRawMode(false)
  rl.close()
  await db.$disconnect()
}
