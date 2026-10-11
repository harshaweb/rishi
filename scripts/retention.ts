import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { removeStored } from "../server/storage.js"
const db = new PrismaClient()
function days(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback)
  if (!Number.isInteger(value) || value < 30 || value > 3650)
    throw new Error(`${name} must be an integer between 30 and 3650.`)
  return new Date(Date.now() - value * 86400000)
}
const leadBefore = days("LEAD_RETENTION_DAYS", 365)
const applicationBefore = days("APPLICATION_RETENTION_DAYS", 180)
try {
  const leads = await db.lead.count({
    where: { status: "CLOSED", updatedAt: { lt: leadBefore } },
  })
  const applications = await db.jobApplication.findMany({
    where: { status: "CLOSED", createdAt: { lt: applicationBefore } },
    include: { resume: true },
  })
  console.log(
    `Retention preview: ${leads} closed enquiries; ${applications.length} closed applications. Active records are excluded.`
  )
  if (process.argv.includes("--apply")) {
    await db.$transaction(async (tx) => {
      await tx.lead.deleteMany({
        where: { status: "CLOSED", updatedAt: { lt: leadBefore } },
      })
      for (const application of applications) {
        await tx.jobApplication.delete({ where: { id: application.id } })
        if (application.resume)
          await tx.mediaAsset.delete({ where: { id: application.resume.id } })
      }
      await tx.$executeRaw`DELETE FROM "RateLimit" WHERE reset < NOW()`
      await tx.auditLog.create({
        data: { action: "RETENTION", entity: "personal-records" },
      })
    })
    for (const application of applications)
      if (application.resume) await removeStored(application.resume.key)
    console.log(
      "Retention completed. Configure and document your production retention policy before scheduling this command."
    )
  } else
    console.log(
      "No data changed. Use --apply only after reviewing your retention obligations and backups."
    )
} finally {
  await db.$disconnect()
  const { disconnect } = await import("../server/db.js")
  await disconnect()
}
