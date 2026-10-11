import "./env.js"
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express"
import session from "express-session"
import connectPgSimple from "connect-pg-simple"
import helmet from "helmet"
import { rateLimit } from "express-rate-limit"
import multer from "multer"
import bcrypt from "bcryptjs"
import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma, pool } from "./db.js"
import { rateStore } from "./rate-store.js"
import { getPublicContent } from "./content.js"
import { notifyLead } from "./mail.js"
import { readStored, removeStored, saveFile } from "./storage.js"
import { siteSettingsSchema } from "./settings.js"
import { readSections, sectionsSchema } from "../shared/sections.js"
import {
  applicationSchema,
  entitySchemas,
  leadSchema,
  leadUpdateSchema,
  loginSchema,
  newsletterSchema,
  noteSchema,
  paginationSchema,
  userSchema,
  type Entity,
} from "./validation.js"

declare module "express-session" {
  interface SessionData {
    userId: string
    csrf: string
  }
}
declare global {
  // Express exposes its request augmentation through this ambient namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: { id: string; role: string; email: string; name: string }
      requestId?: string
    }
  }
}
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
const fail = (status: number, message: string) =>
  Object.assign(new Error(message), { status })
export const app = express()
app.disable("x-powered-by")
if (process.env.TRUST_PROXY === "1" || process.env.VERCEL === "1")
  app.set("trust proxy", 1)
const production = process.env.NODE_ENV === "production"
if (
  !process.env.DATABASE_URL ||
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
)
  throw new Error(
    "DATABASE_URL and a SESSION_SECRET of at least 32 characters are required. Run npm run setup:local for local development."
  )
if (production && !process.env.SITE_URL?.startsWith("https://"))
  throw new Error("Production SITE_URL must use HTTPS.")
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          ...(process.env.GA4_MEASUREMENT_ID || process.env.GTM_CONTAINER_ID
            ? ["https://www.googletagmanager.com"]
            : []),
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: [
          "'self'",
          ...(process.env.GA4_MEASUREMENT_ID || process.env.GTM_CONTAINER_ID
            ? [
                "https://*.google-analytics.com",
                "https://*.analytics.google.com",
                "https://www.googletagmanager.com",
              ]
            : []),
        ],
        objectSrc: ["'none'"],
        frameSrc: [
          "'self'",
          "https://www.youtube-nocookie.com",
          "https://player.vimeo.com",
        ],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
    strictTransportSecurity: production ? undefined : false,
  })
)
app.use(express.json({ limit: "160kb" }))
app.use((req, res, next) => {
  req.requestId = randomUUID()
  res.setHeader("X-Request-ID", req.requestId)
  next()
})
const PgSession = connectPgSimple(session)
app.use(
  session({
    store: new PgSession({ pool, tableName: "Session" }),
    name: "harshaweb.sid",
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
)
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  next()
})
app.use("/api", (req, _res, next) => {
  if (!["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) return next()
  const allowed = [
    process.env.SITE_URL || "http://localhost:5173",
    ...(!production
      ? [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:3001",
        ]
      : []),
  ]
  if (!req.headers.origin || !allowed.includes(req.headers.origin))
    return next(fail(403, "This request origin is not allowed."))
  next()
})
const publicLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: rateStore("public:"),
  message: { error: "Too many submissions. Please try again in 15 minutes." },
})
const loginLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: rateStore("login:"),
  message: {
    error: "Too many login attempts. Please try again in 15 minutes.",
  },
})
const authenticated = asyncHandler(async (req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
  if (!req.session.userId) throw fail(401, "Please sign in to continue.")
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  })
  if (!user?.active) throw fail(401, "Your session is no longer valid.")
  req.staff = user
  if (
    !["GET", "HEAD"].includes(req.method) &&
    (!req.session.csrf || req.headers["x-csrf-token"] !== req.session.csrf)
  )
    throw fail(403, "Your security token has expired. Refresh and try again.")
  next()
})
const adminOnly = (req: Request, _res: Response, next: NextFunction) =>
  req.staff?.role === "ADMIN"
    ? next()
    : next(fail(403, "Administrator access is required."))
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 15, fieldSize: 10000 },
})

app.get("/api/analytics-config", (_req, res) => {
  res.json({
    ga4: process.env.GA4_MEASUREMENT_ID || "",
    gtm: process.env.GTM_CONTAINER_ID || "",
  })
})
app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: "ok", database: "connected" })
  })
)
app.get(
  "/api/content",
  asyncHandler(async (_req, res) => {
    res.json(await getPublicContent())
  })
)
app.get(
  "/api/auth/session",
  asyncHandler(async (req, res) => {
    req.session.csrf ||= randomUUID()
    const user = req.session.userId
      ? await prisma.user.findUnique({
          where: { id: req.session.userId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
          },
        })
      : null
    res.json({ user: user?.active ? user : null, csrf: req.session.csrf })
  })
)
app.post(
  "/api/auth/login",
  loginLimit,
  asyncHandler(async (req, res) => {
    if (!req.session.csrf || req.headers["x-csrf-token"] !== req.session.csrf)
      throw fail(403, "Refresh this page before signing in.")
    const data = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: data.email } })
    const valid = await bcrypt.compare(
      data.password,
      user?.passwordHash ||
        "$2b$12$LdDg9hvgCDfVYN3mzgq5tuS/uYfY4RNUDeQ.PjgtPxkqD/txVcu42"
    )
    if (!user?.active || !valid)
      throw fail(401, "Email or password is incorrect.")
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve()))
    )
    req.session.userId = user.id
    req.session.csrf = randomUUID()
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entity: "users",
        recordId: user.id,
      },
    })
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      csrf: req.session.csrf,
    })
  })
)
app.post(
  "/api/auth/logout",
  authenticated,
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve()))
    )
    res.clearCookie("harshaweb.sid", {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
    })
    res.json({ ok: true })
  })
)

app.post(
  "/api/leads",
  publicLimit,
  asyncHandler(async (req, res) => {
    const data = leadSchema.parse(req.body)
    const known = await prisma.service.findFirst({
      where: { title: data.service, published: true },
    })
    if (!known && data.service !== "Not sure yet")
      throw fail(400, "Please choose an available service.")
    const existing = await prisma.lead.findUnique({
      where: { submissionId: data.submissionId },
    })
    if (
      existing &&
      (existing.email !== data.email || existing.message !== data.message)
    )
      throw fail(
        409,
        "This submission reference has already been used. Refresh and try again."
      )
    const duplicate =
      existing ||
      (await prisma.lead.findFirst({
        where: {
          email: data.email,
          message: data.message,
          createdAt: { gte: new Date(Date.now() - 5 * 60000) },
        },
      }))
    if (duplicate)
      return res.json({
        reference: duplicate.reference,
        emailStatus: duplicate.emailStatus,
        duplicate: true,
      })
    const { consent: _consent, companyFax: _fax, ...fields } = data
    let lead
    try {
      lead = await prisma.lead.create({
        data: {
          ...fields,
          consentAt: new Date(),
          reference: `HW-${randomUUID().slice(0, 8).toUpperCase()}`,
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const retry = await prisma.lead.findUnique({
          where: { submissionId: data.submissionId },
        })
        if (
          retry &&
          retry.email === data.email &&
          retry.message === data.message
        )
          return res.json({
            reference: retry.reference,
            emailStatus: retry.emailStatus,
            duplicate: true,
          })
      }
      throw error
    }
    const emailStatus = await notifyLead(lead)
    res.status(201).json({ reference: lead.reference, emailStatus })
  })
)
app.post(
  "/api/newsletter",
  publicLimit,
  asyncHandler(async (req, res) => {
    const data = newsletterSchema.parse(req.body)
    await prisma.newsletterSubscriber.upsert({
      where: { email: data.email },
      create: { email: data.email, consentAt: new Date() },
      update: {
        active: true,
        consentAt: new Date(),
        unsubscribeToken: randomUUID(),
      },
    })
    res.status(201).json({
      message:
        "Your newsletter subscription is saved. You can unsubscribe at any time using the link in future newsletters.",
    })
  })
)
app.post(
  "/api/newsletter/unsubscribe",
  publicLimit,
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().uuid() }).parse(req.body)
    await prisma.newsletterSubscriber.updateMany({
      where: { unsubscribeToken: token },
      data: { active: false },
    })
    res.json({
      message:
        "The subscription is inactive. You will not receive future newsletters.",
    })
  })
)
app.post(
  "/api/applications",
  publicLimit,
  upload.single("resume"),
  asyncHandler(async (req, res) => {
    const data = applicationSchema.parse({
      ...req.body,
      consent: req.body.consent === "true",
    })
    if (
      data.jobId &&
      !(await prisma.job.findFirst({
        where: { id: data.jobId, published: true },
      }))
    )
      throw fail(400, "This position is no longer available.")
    if (
      await prisma.jobApplication.findFirst({
        where: {
          email: data.email,
          message: data.message,
          createdAt: { gte: new Date(Date.now() - 5 * 60000) },
        },
      })
    )
      return res.json({
        message:
          "Your application was already saved. Thank you for your interest.",
      })
    const asset = req.file ? await saveFile(req.file, false) : null
    try {
      const { consent: _consent, ...fields } = data
      await prisma.jobApplication.create({
        data: {
          ...fields,
          jobId: data.jobId || null,
          consentAt: new Date(),
          resumeId: asset?.id,
        },
      })
    } catch (error) {
      if (asset) {
        await prisma.mediaAsset.delete({ where: { id: asset.id } })
        await removeStored(asset.key)
      }
      throw error
    }
    res.status(201).json({
      message:
        "Your application has been saved. No confirmation email has been sent.",
    })
  })
)
app.get(
  "/media/:id",
  asyncHandler(async (req, res) => {
    const media = await prisma.mediaAsset.findFirst({
      where: { id: String(req.params.id), public: true },
    })
    if (!media) throw fail(404, "Image not found.")
    res.setHeader("Content-Type", media.mime)
    res.setHeader("Cache-Control", "public, max-age=86400")
    res.send(await readStored(media.key))
  })
)

app.use("/api/admin", authenticated)
app.get(
  "/api/admin/metrics",
  asyncHandler(async (_req, res) => {
    const [leads, newLeads, subscribers, posts, applications, recent, grouped] =
      await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { status: "NEW" } }),
        prisma.newsletterSubscriber.count({ where: { active: true } }),
        prisma.blogPost.count({
          where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
        }),
        prisma.jobApplication.count(),
        prisma.lead.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
        prisma.lead.groupBy({ by: ["status"], _count: true }),
      ])
    res.json({
      leads,
      newLeads,
      subscribers,
      posts,
      applications,
      recent,
      grouped,
    })
  })
)
export function csvCell(value: unknown) {
  let text = String(value ?? "")
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
function leadWhere(req: Request) {
  const { search, status } = paginationSchema.parse(req.query)
  if (
    status &&
    !["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "CLOSED"].includes(
      status
    )
  )
    throw fail(400, "Choose a valid lead status.")
  return {
    ...(status ? { status: status as "NEW" } : {}),
    ...(search
      ? {
          OR: ["name", "email", "company", "reference"].map((field) => ({
            [field]: { contains: search, mode: "insensitive" },
          })),
        }
      : {}),
  }
}
app.get(
  "/api/admin/leads/export",
  asyncHandler(async (req, res) => {
    const rows = await prisma.lead.findMany({
      where: leadWhere(req),
      orderBy: { createdAt: "desc" },
      take: 10000,
    })
    const keys = [
      "reference",
      "name",
      "email",
      "phone",
      "company",
      "service",
      "budget",
      "timeline",
      "status",
      "message",
      "createdAt",
    ] as const
    await prisma.auditLog.create({
      data: { userId: req.staff!.id, action: "EXPORT", entity: "leads" },
    })
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="harshaweb-leads.csv"'
    )
    res.send(
      "\uFEFF" +
        [
          keys.map(csvCell).join(","),
          ...rows.map((row) =>
            keys
              .map((key) =>
                csvCell(
                  row[key] instanceof Date ? row[key].toISOString() : row[key]
                )
              )
              .join(",")
          ),
        ].join("\r\n")
    )
  })
)
app.get(
  "/api/admin/leads",
  asyncHandler(async (req, res) => {
    const { page } = paginationSchema.parse(req.query)
    const where = leadWhere(req)
    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 15,
        take: 15,
      }),
      prisma.lead.count({ where }),
    ])
    res.json({ items, total, page, pageSize: 15 })
  })
)
app.get(
  "/api/admin/leads/:id",
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.findUnique({
      where: { id: String(req.params.id) },
      include: {
        notes: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    })
    if (!lead) throw fail(404, "Enquiry not found.")
    res.json(lead)
  })
)
app.patch(
  "/api/admin/leads/:id",
  asyncHandler(async (req, res) => {
    const data = leadUpdateSchema.parse(req.body)
    const item = await prisma.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id: String(req.params.id) },
        data,
      })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "UPDATE",
          entity: "leads",
          recordId: result.id,
        },
      })
      return result
    })
    res.json(item)
  })
)
app.post(
  "/api/admin/leads/:id/notes",
  asyncHandler(async (req, res) => {
    const { body } = noteSchema.parse(req.body)
    const item = await prisma.$transaction(async (tx) => {
      const note = await tx.leadNote.create({
        data: { body, userId: req.staff!.id, leadId: String(req.params.id) },
      })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "ADD_NOTE",
          entity: "leads",
          recordId: String(req.params.id),
        },
      })
      return note
    })
    res.status(201).json(item)
  })
)
app.delete(
  "/api/admin/leads/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.$transaction([
      prisma.lead.delete({ where: { id: String(req.params.id) } }),
      prisma.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "DELETE",
          entity: "leads",
          recordId: String(req.params.id),
        },
      }),
    ])
    res.json({ ok: true })
  })
)

app.get(
  "/api/admin/sections",
  adminOnly,
  asyncHandler(async (_req, res) => {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "sectionContent" },
    })
    res.json(readSections(setting?.value || "{}"))
  })
)
app.patch(
  "/api/admin/sections/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)
    const validated = sectionsSchema.parse({ [id]: req.body })
    await prisma.$transaction(async (tx) => {
      const setting = await tx.siteSetting.findUnique({
        where: { key: "sectionContent" },
      })
      const next = { ...readSections(setting?.value || "{}"), ...validated }
      const value = JSON.stringify(next)
      if (value.length > 100000)
        throw fail(400, "Website section content is too large.")
      await tx.siteSetting.upsert({
        where: { key: "sectionContent" },
        create: { key: "sectionContent", value },
        update: { value },
      })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "UPDATE",
          entity: "sections",
          recordId: id,
        },
      })
    })
    res.json(validated[id])
  })
)
app.get(
  "/api/admin/settings",
  adminOnly,
  asyncHandler(async (_req, res) => {
    res.json((await getPublicContent()).settings)
  })
)
app.patch(
  "/api/admin/settings",
  adminOnly,
  asyncHandler(async (req, res) => {
    const data = siteSettingsSchema.partial().parse(req.body)
    if (
      data.contactEmail &&
      !z.string().email().safeParse(data.contactEmail).success
    )
      throw fail(400, "Enter a valid contact email.")
    await prisma.$transaction([
      ...Object.entries(data)
        .filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
        .map(([key, value]) =>
          prisma.siteSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          })
        ),
      prisma.auditLog.create({
        data: { userId: req.staff!.id, action: "UPDATE", entity: "settings" },
      }),
    ])
    res.json(data)
  })
)
app.get(
  "/api/admin/users",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { page, search } = paginationSchema.parse(req.query)
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
        },
        skip: (page - 1) * 15,
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ])
    res.json({ items, total, page, pageSize: 15 })
  })
)
app.post(
  "/api/admin/users",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { password, ...data } = userSchema.parse(req.body)
    if (!password)
      throw fail(400, "A password of at least 12 characters is required.")
    const passwordHash = await bcrypt.hash(password, 12)
    const item = await prisma.$transaction(async (tx) => {
      const result = await tx.user.create({
        data: { ...data, passwordHash },
        select: { id: true, name: true, email: true, role: true, active: true },
      })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "CREATE",
          entity: "users",
          recordId: result.id,
        },
      })
      return result
    })
    res.status(201).json(item)
  })
)
app.patch(
  "/api/admin/users/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { password, ...data } = userSchema.partial().parse(req.body)
    if (
      req.staff!.id === req.params.id &&
      (data.active === false || (data.role && data.role !== "ADMIN"))
    )
      throw fail(
        400,
        "You cannot disable or demote your own administrator account."
      )
    const fields = {
      ...data,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    }
    const item = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: String(req.params.id) },
        data: fields,
        select: { id: true, name: true, email: true, role: true, active: true },
      })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "UPDATE",
          entity: "users",
          recordId: result.id,
        },
      })
      return result
    })
    if (password)
      await pool.query("DELETE FROM \"Session\" WHERE sess->>'userId' = $1", [
        req.params.id,
      ])
    res.json(item)
  })
)
app.get(
  "/api/admin/audit",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { page } = paginationSchema.parse(req.query)
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 15,
        take: 15,
      }),
      prisma.auditLog.count(),
    ])
    res.json({ items, total, page, pageSize: 15 })
  })
)
app.get(
  "/api/admin/applications",
  asyncHandler(async (req, res) => {
    const { page, search, status } = paginationSchema.parse(req.query)
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        include: { job: { select: { title: true } } },
        skip: (page - 1) * 15,
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobApplication.count({ where }),
    ])
    res.json({ items, total, page, pageSize: 15 })
  })
)
app.patch(
  "/api/admin/applications/:id",
  asyncHandler(async (req, res) => {
    const data = z
      .object({ status: z.enum(["NEW", "REVIEWING", "CONTACTED", "CLOSED"]) })
      .parse(req.body)
    await prisma.$transaction([
      prisma.jobApplication.update({
        where: { id: String(req.params.id) },
        data,
      }),
      prisma.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "UPDATE",
          entity: "applications",
          recordId: String(req.params.id),
        },
      }),
    ])
    res.json({ ok: true })
  })
)
app.delete(
  "/api/admin/applications/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const application = await prisma.jobApplication.findUniqueOrThrow({
      where: { id: String(req.params.id) },
      include: { resume: true },
    })
    await prisma.$transaction(async (tx) => {
      await tx.jobApplication.delete({ where: { id: application.id } })
      if (application.resume)
        await tx.mediaAsset.delete({ where: { id: application.resume.id } })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "DELETE",
          entity: "applications",
          recordId: application.id,
        },
      })
    })
    if (application.resume) await removeStored(application.resume.key)
    res.json({ ok: true })
  })
)
app.get(
  "/api/admin/subscribers",
  asyncHandler(async (req, res) => {
    const { page, search } = paginationSchema.parse(req.query)
    const where = search
      ? { email: { contains: search, mode: "insensitive" as const } }
      : {}
    const [items, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        select: {
          id: true,
          email: true,
          active: true,
          consentAt: true,
          createdAt: true,
        },
        skip: (page - 1) * 15,
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
      prisma.newsletterSubscriber.count({ where }),
    ])
    res.json({ items, total, page, pageSize: 15 })
  })
)
app.patch(
  "/api/admin/subscribers/:id",
  asyncHandler(async (req, res) => {
    const data = z.object({ active: z.literal(false) }).parse(req.body)
    await prisma.$transaction([
      prisma.newsletterSubscriber.update({
        where: { id: String(req.params.id) },
        data,
      }),
      prisma.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "UNSUBSCRIBE",
          entity: "subscribers",
          recordId: String(req.params.id),
        },
      }),
    ])
    res.json({ ok: true })
  })
)
app.delete(
  "/api/admin/subscribers/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.$transaction([
      prisma.newsletterSubscriber.delete({
        where: { id: String(req.params.id) },
      }),
      prisma.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "DELETE",
          entity: "subscribers",
          recordId: String(req.params.id),
        },
      }),
    ])
    res.json({ ok: true })
  })
)
app.get(
  "/api/admin/media",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { page } = paginationSchema.parse(req.query)
    const [items, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where: { public: true },
        skip: (page - 1) * 15,
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
      prisma.mediaAsset.count({ where: { public: true } }),
    ])
    res.json({
      items: items.map((i) => ({ ...i, path: `/media/${i.id}` })),
      total,
      page,
      pageSize: 15,
    })
  })
)
app.post(
  "/api/admin/media",
  adminOnly,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw fail(400, "Choose an image to upload.")
    const alt = z.string().trim().min(3).max(300).parse(req.body.alt)
    const asset = await saveFile(req.file, true, alt)
    await prisma.auditLog.create({
      data: {
        userId: req.staff!.id,
        action: "UPLOAD",
        entity: "media",
        recordId: asset.id,
      },
    })
    res.status(201).json({ ...asset, path: `/media/${asset.id}` })
  })
)
app.get(
  "/api/admin/media/:id/file",
  asyncHandler(async (req, res) => {
    const media = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: String(req.params.id) },
    })
    await prisma.auditLog.create({
      data: {
        userId: req.staff!.id,
        action: "DOWNLOAD",
        entity: "media",
        recordId: media.id,
      },
    })
    res.setHeader("Content-Type", media.mime)
    res.attachment(media.filename)
    res.send(await readStored(media.key))
  })
)
app.delete(
  "/api/admin/media/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const asset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: String(req.params.id) },
      include: { application: true },
    })
    if (asset.application)
      throw fail(409, "Delete the associated application to remove its résumé.")
    const path = `/media/${asset.id}`
    const usage = await Promise.all([
      prisma.blogPost.count({ where: { cover: path } }),
      prisma.portfolioProject.count({
        where: { OR: [{ cover: path }, { gallery: { has: path } }] },
      }),
      prisma.teamMember.count({ where: { photo: path } }),
    ])
    if (usage.some(Boolean))
      throw fail(
        409,
        "This image is used in published or draft content. Remove those references first."
      )
    await prisma.$transaction([
      prisma.mediaAsset.delete({ where: { id: asset.id } }),
      prisma.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "DELETE",
          entity: "media",
          recordId: asset.id,
        },
      }),
    ])
    await removeStored(asset.key)
    res.json({ ok: true })
  })
)

// Only explicitly listed models are addressable. Validated fields are mapped to Prisma delegates.
const models = {
  services: "service",
  industries: "industry",
  projects: "portfolioProject",
  posts: "blogPost",
  categories: "blogCategory",
  tags: "blogTag",
  faqs: "fAQ",
  team: "teamMember",
  jobs: "job",
} as const
const entityGuard = (req: Request, _res: Response, next: NextFunction) => {
  const entity = String(req.params.entity)
  if (!Object.hasOwn(models, entity))
    return next(fail(404, "This resource does not exist."))
  if (
    req.staff!.role !== "ADMIN" &&
    !["services", "industries", "posts", "categories", "tags", "faqs"].includes(
      entity
    )
  )
    return next(fail(403, "Administrator access is required."))
  next()
}
// Dynamic dispatch is restricted to the allowlist above; each payload has its own Zod schema.
type Delegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  count: (args: unknown) => Promise<number>
  create: (args: unknown) => Promise<{ id: string }>
  update: (args: unknown) => Promise<{ id: string }>
  delete: (args: unknown) => Promise<unknown>
}
const delegate = (client: unknown, entity: Entity) =>
  (client as Record<string, Delegate>)[models[entity]]
app.get(
  "/api/admin/:entity",
  entityGuard,
  asyncHandler(async (req, res) => {
    const entity = req.params.entity as Entity
    const { page, search } = paginationSchema.parse(req.query)
    const field =
      entity === "faqs" ? "question" : entity === "team" ? "name" : "title"
    const where = search
      ? { [field]: { contains: search, mode: "insensitive" } }
      : {}
    const db = delegate(prisma, entity)
    const include =
      entity === "posts"
        ? { tags: true }
        : entity === "projects"
          ? { serviceRecords: true }
          : undefined
    const [items, total] = await Promise.all([
      db.findMany({
        where,
        include,
        orderBy: { id: "asc" },
        skip: (page - 1) * 15,
        take: 15,
      }),
      db.count({ where }),
    ])
    res.json({
      items: items.map((item) => ({
        ...item,
        ...(entity === "posts"
          ? { tagIds: (item.tags as { id: string }[]).map((t) => t.id) }
          : {}),
        ...(entity === "projects"
          ? {
              serviceIds: (item.serviceRecords as { id: string }[]).map(
                (s) => s.id
              ),
            }
          : {}),
      })),
      total,
      page,
      pageSize: 15,
    })
  })
)
function entityData(entity: Entity, body: unknown, partial: boolean) {
  const schema = entitySchemas[entity]
  const data = (partial ? schema.partial() : schema).parse(body) as Record<
    string,
    unknown
  >
  if (entity === "posts" && data.status === "PUBLISHED" && !data.publishedAt)
    data.publishedAt = new Date().toISOString()
  if (entity === "posts" && "tagIds" in data) {
    data.tags = {
      set: [],
      connect: (data.tagIds as string[]).map((id) => ({ id })),
    }
    delete data.tagIds
  }
  if (entity === "projects" && "serviceIds" in data) {
    data.serviceRecords = {
      set: [],
      connect: (data.serviceIds as string[]).map((id) => ({ id })),
    }
    delete data.serviceIds
  }
  for (const key of ["categoryId", "industryId", "serviceId"])
    if (data[key] === "") data[key] = null
  return data
}
app.post(
  "/api/admin/:entity",
  entityGuard,
  asyncHandler(async (req, res) => {
    const entity = req.params.entity as Entity
    const data = entityData(entity, req.body, false)
    for (const key of ["tags", "serviceRecords"])
      if (data[key]) delete (data[key] as Record<string, unknown>).set
    const item = await prisma.$transaction(async (tx) => {
      const result = await delegate(tx, entity).create({ data })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "CREATE",
          entity,
          recordId: result.id,
        },
      })
      return result
    })
    res.status(201).json(item)
  })
)
app.patch(
  "/api/admin/:entity/:id",
  entityGuard,
  asyncHandler(async (req, res) => {
    const entity = req.params.entity as Entity
    const data = entityData(entity, req.body, true)
    const item = await prisma.$transaction(async (tx) => {
      const result = await delegate(tx, entity).update({
        where: { id: String(req.params.id) },
        data,
      })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "UPDATE",
          entity,
          recordId: result.id,
        },
      })
      return result
    })
    res.json(item)
  })
)
app.delete(
  "/api/admin/:entity/:id",
  entityGuard,
  adminOnly,
  asyncHandler(async (req, res) => {
    const entity = req.params.entity as Entity
    await prisma.$transaction(async (tx) => {
      await delegate(tx, entity).delete({
        where: { id: String(req.params.id) },
      })
      await tx.auditLog.create({
        data: {
          userId: req.staff!.id,
          action: "DELETE",
          entity,
          recordId: String(req.params.id),
        },
      })
    })
    res.json({ ok: true })
  })
)
app.use("/api", (_req, _res, next) =>
  next(fail(404, "This API endpoint does not exist."))
)
export function apiError(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof z.ZodError)
    return res.status(400).json({
      error: "Please check the highlighted fields.",
      fields: Object.fromEntries(
        error.issues.map((issue) => [issue.path.join("."), issue.message])
      ),
    })
  if (error instanceof multer.MulterError)
    return res
      .status(400)
      .json({ error: "Upload one file no larger than 4 MB." })
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status =
      error.code === "P2025"
        ? 404
        : ["P2002", "P2003"].includes(error.code)
          ? 409
          : 500
    return res.status(status).json({
      error:
        status === 404
          ? "Record not found."
          : status === 409
            ? "This record conflicts with existing data. Check unique fields and related records."
            : "The request could not be completed.",
      requestId: req.requestId,
    })
  }
  const value = error as { status?: number; message?: string; type?: string }
  const status =
    value.status && value.status >= 400 && value.status < 600
      ? value.status
      : 500
  if (status >= 500)
    console.error(
      "Request failed",
      req.requestId,
      error instanceof Error ? error.name : "Unknown error"
    )
  return res.status(status).json({
    error:
      status < 500
        ? value.type === "entity.parse.failed"
          ? "The request body is invalid."
          : value.message
        : "The service is temporarily unavailable. Please try again.",
    requestId: req.requestId,
  })
}
