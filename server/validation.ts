import { z } from "zod"

export function parsePatch<T extends z.ZodObject>(
  schema: T,
  input: unknown
): Partial<z.output<T>> {
  const parsed = schema.partial().parse(input)
  // Zod defaults may run inside optional fields. PATCH only writes supplied keys.
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) =>
      Object.hasOwn(input as object, key)
    )
  ) as Partial<z.output<T>>
}

const text = (max = 300) =>
  z.string().trim().min(1, "This field is required.").max(max)
const optionalText = (max = 300) => z.string().trim().max(max).default("")
const slug = text(120).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "Use lowercase words separated by hyphens."
)
const url = z
  .union([
    z.literal(""),
    z
      .string()
      .url()
      .regex(/^https?:\/\//, "Use an HTTP or HTTPS URL."),
  ])
  .default("")
const cover = z
  .string()
  .max(500)
  .refine(
    (value) =>
      !value.includes(":") && !value.startsWith("//") && !value.includes(".."),
    "Choose an uploaded media path or a built-in illustration."
  )
const list = z.array(text(300)).max(30)
const seo = { seoTitle: optionalText(100), seoDescription: optionalText(180) }
const publish = {
  published: z.boolean().default(false),
  order: z.number().int().min(0).max(10000).default(0),
}
export const leadSchema = z.object({
  submissionId: z.string().uuid(),
  name: text(100),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: text(30)
    .regex(
      /^\+[1-9][\d ()-]{6,24}$/,
      "Include your country code, for example +91 98765 43210."
    )
    .refine(
      (value) => /^\+[1-9]\d{7,14}$/.test(value.replace(/[ ()-]/g, "")),
      "Enter 8–15 digits including the country code."
    ),
  company: text(150),
  website: url,
  service: text(150),
  budget: z.enum([
    "Under ₹50,000",
    "₹50,000–₹2 lakh",
    "₹2–5 lakh",
    "₹5 lakh+",
    "Let’s discuss",
  ]),
  timeline: z.enum([
    "As soon as practical",
    "1–3 months",
    "3–6 months",
    "Exploring options",
  ]),
  message: text(6000).min(
    20,
    "Please share at least 20 characters about your project."
  ),
  kind: z
    .enum(["quote", "contact", "website", "application", "marketing"])
    .default("quote"),
  consent: z.literal(true, { error: "Please agree to the privacy policy." }),
  companyFax: z.string().max(0).optional(),
})
export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  consent: z.literal(true),
  companyFax: z.string().max(0).optional(),
})
export const applicationSchema = z.object({
  name: text(100),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  message: text(6000).min(20),
  portfolio: url,
  jobId: z.string().max(100).optional(),
  consent: z.literal(true),
})
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: text(72),
})
export const userSchema = z.object({
  name: text(100),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  role: z.enum(["ADMIN", "STAFF"]),
  active: z.boolean().default(true),
  password: z.string().min(12).max(72).optional(),
})
export const entitySchemas = {
  services: z.object({
    slug,
    title: text(),
    headline: text(),
    description: text(1000),
    category: text(100),
    benefits: list,
    process: list,
    body: text(30000),
    ...publish,
    ...seo,
  }),
  industries: z.object({
    slug,
    title: text(),
    description: text(1000),
    benefits: list,
    body: text(30000),
    ...publish,
    ...seo,
  }),
  projects: z.object({
    slug,
    title: text(),
    description: text(1000),
    body: text(30000),
    industry: text(),
    industryId: z.string().nullable().optional(),
    serviceIds: z.array(z.string()).optional(),
    services: list,
    technologies: list,
    demo: z.boolean().default(true),
    cover,
    gallery: z.array(cover).max(20),
    url,
    results: optionalText(3000),
    ...publish,
    ...seo,
  }),
  posts: z.object({
    slug,
    title: text(),
    description: text(1000),
    body: text(60000),
    categoryId: z.string().nullable().optional(),
    tagIds: z.array(z.string()).max(20).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    cover,
    featured: z.boolean().default(false),
    publishedAt: z.string().datetime().nullable().optional(),
    ...seo,
  }),
  categories: z.object({ slug, title: text(100) }),
  tags: z.object({ slug, title: text(100) }),
  faqs: z.object({
    question: text(500),
    answer: text(6000),
    serviceId: z.string().nullable().optional(),
    ...publish,
  }),
  team: z.object({
    name: text(100),
    role: text(100),
    bio: text(4000),
    photo: cover.default(""),
    ...publish,
  }),
  jobs: z.object({
    slug,
    title: text(),
    location: text(200),
    type: text(100),
    description: text(1000),
    body: text(30000),
    published: z.boolean().default(false),
  }),
}
export type Entity = keyof typeof entitySchemas
export const leadUpdateSchema = z.object({
  status: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "CLOSED"])
    .optional(),
  followUpAt: z.string().datetime().nullable().optional(),
})
export const noteSchema = z.object({ body: text(6000) })
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: z.string().max(200).default(""),
  status: z.string().max(50).default(""),
})
