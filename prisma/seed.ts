import "../server/database-url.js"
import { PrismaClient } from "@prisma/client"
import { initialContent } from "../shared/content.js"
const db = new PrismaClient()
try {
  for (const row of initialContent.services)
    await db.service.upsert({ where: { id: row.id }, create: row, update: {} })
  for (const row of initialContent.industries)
    await db.industry.upsert({ where: { id: row.id }, create: row, update: {} })
  for (const row of initialContent.categories)
    await db.blogCategory.upsert({
      where: { id: row.id },
      create: row,
      update: {},
    })
  for (const row of initialContent.tags)
    await db.blogTag.upsert({ where: { id: row.id }, create: row, update: {} })
  for (const row of initialContent.projects)
    await db.portfolioProject.upsert({
      where: { id: row.id },
      create: {
        ...row,
        industryId: initialContent.industries.find(
          (i) => i.title === row.industry
        )?.id,
        serviceRecords: {
          connect: initialContent.services
            .filter((s) =>
              row.services.some((label) => s.title.includes(label))
            )
            .map((s) => ({ id: s.id })),
        },
      },
      update: {},
    })
  for (const row of initialContent.posts)
    await db.blogPost.upsert({
      where: { id: row.id },
      create: {
        ...row,
        status: "PUBLISHED",
        tags: { connect: [{ id: row.id === "post-1" ? "tag-1" : "tag-0" }] },
      },
      update: {},
    })
  for (const row of initialContent.faqs)
    await db.fAQ.upsert({ where: { id: row.id }, create: row, update: {} })
  for (const service of initialContent.services) {
    const faqs = [
      {
        question: `What can your ${service.title.toLowerCase()} service help with?`,
        answer: `${service.description} Typical scope can include ${service.benefits.join("; ").toLowerCase()}. We confirm deliverables during discovery.`,
      },
      {
        question: `How do you plan a ${service.category.toLowerCase()} project?`,
        answer: `Our approach for this service follows ${service.process.join(", then ").toLowerCase()}. Timelines and dependencies are set out in your proposal.`,
      },
      {
        question: "Can this work connect to our existing tools?",
        answer: `We review your current setup as part of ${service.process[0].toLowerCase()}. Integration feasibility, access and operational ownership are agreed before implementation.`,
      },
    ]
    for (const [i, faq] of faqs.entries())
      await db.fAQ.upsert({
        where: { id: `${service.id}-faq-${i}` },
        create: {
          id: `${service.id}-faq-${i}`,
          ...faq,
          serviceId: service.id,
          published: true,
          order: i,
        },
        update: {},
      })
  }
  for (const [key, value] of Object.entries(initialContent.settings))
    await db.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    })
  console.log(
    "Seeded editable public content. No users, client claims or personal submissions were created."
  )
} finally {
  await db.$disconnect()
}
