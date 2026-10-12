import { publicRentals } from "./rental-core.js"
import { prisma } from "./db.js"
import { settings as defaults } from "../shared/content.js"
export async function getPublicContent(rentalSlug?: string) {
  const [
    services,
    industries,
    projects,
    posts,
    categories,
    tags,
    faqs,
    team,
    jobs,
    rows,
  ] = await Promise.all([
    prisma.service.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    }),
    prisma.industry.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    }),
    prisma.portfolioProject.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      include: { tags: { select: { id: true, slug: true, title: true } } },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.blogCategory.findMany(),
    prisma.blogTag.findMany(),
    prisma.fAQ.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    }),
    prisma.teamMember.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    }),
    prisma.job.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.siteSetting.findMany(),
  ])
  return {
    rentals: await publicRentals(rentalSlug),
    services,
    industries,
    projects,
    posts,
    categories,
    tags,
    faqs,
    team,
    jobs,
    settings: {
      ...defaults,
      ...Object.fromEntries(rows.map((s) => [s.key, s.value])),
    },
  }
}
