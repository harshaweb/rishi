import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { app, apiError, csvCell } from "../server/app"
import { disconnect, pool, prisma } from "../server/db"
app.use(apiError)
const origin = "http://localhost:5173"
describe("Editable video and contact configuration", () => {
  it("persists authorized settings and rejects unsafe links or staff writes", async () => {
    const { agent, csrf } = await login()
    const previous = (await agent.get("/api/admin/settings")).body
    const updated = {
      ...previous,
      whatsappPhone: "+91 98765 43210",
      bookingUrl: "https://example.com/calendar",
      video2Title: "Test walkthrough",
      video2Url: "https://youtu.be/abcdefghijk",
    }
    try {
      const saved = await agent
        .patch("/api/admin/settings")
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send(updated)
      expect(saved.status).toBe(200)
      expect(
        (await request(app).get("/api/content")).body.settings.video2Title
      ).toBe("Test walkthrough")
      const invalid = await agent
        .patch("/api/admin/settings")
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send({ ...updated, bookingUrl: "javascript:alert(1)" })
      expect(invalid.status).toBe(400)
      expect(invalid.body.fields.bookingUrl).toBeTruthy()
      const staff = await login("staff")
      expect(
        (
          await staff.agent
            .patch("/api/admin/settings")
            .set("Origin", origin)
            .set("X-CSRF-Token", staff.csrf)
            .send(updated)
        ).status
      ).toBe(403)
      expect(
        (await request(app).get("/api/content")).body.settings.bookingUrl
      ).toBe("https://example.com/calendar")
    } finally {
      await agent
        .patch("/api/admin/settings")
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send(previous)
    }
  })
})
const password = process.env.TEST_ADMIN_PASSWORD!
describe("Protected website section editing", () => {
  it("persists a section, preserves it during settings updates, and rejects staff and invalid writes", async () => {
    const { agent, csrf } = await login()
    const previous = (await agent.get("/api/admin/sections")).body
    try {
      const result = await agent
        .patch("/api/admin/sections/footer")
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send({ title: "A tested footer heading" })
      expect(result.status).toBe(200)
      await agent
        .patch("/api/admin/settings")
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send({ maintenanceNotice: "" })
      expect(
        JSON.parse(
          (await request(app).get("/api/content")).body.settings.sectionContent
        ).footer.title
      ).toBe("A tested footer heading")
      expect(
        (
          await agent
            .patch("/api/admin/sections/unknown")
            .set("Origin", origin)
            .set("X-CSRF-Token", csrf)
            .send({ title: "Invalid" })
        ).status
      ).toBe(400)
      expect(
        (
          await agent
            .patch("/api/admin/sections/header")
            .set("Origin", origin)
            .set("X-CSRF-Token", csrf)
            .send({ hidden: true })
        ).status
      ).toBe(400)
      const staff = await login("staff")
      expect(
        (
          await staff.agent
            .patch("/api/admin/sections/footer")
            .set("Origin", origin)
            .set("X-CSRF-Token", staff.csrf)
            .send({ title: "Forbidden" })
        ).status
      ).toBe(403)
      expect((await request(app).get("/api/admin/sections")).status).toBe(401)
    } finally {
      await agent
        .patch("/api/admin/sections/footer")
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send(previous.footer || {})
    }
  })
})
const leadData = (extra = {}) => ({
  submissionId: crypto.randomUUID(),
  name: "Integration visitor",
  email: `visitor-${crypto.randomUUID()}@example.com`,
  phone: "+91 98765 43210",
  company: "Test business",
  website: "",
  service: "Not sure yet",
  budget: "Let’s discuss",
  timeline: "Exploring options",
  message: "We need a dependable website with accessible navigation.",
  consent: true,
  ...extra,
})
async function login(role: "admin" | "staff" = "admin") {
  const agent = request.agent(app)
  const initial = await agent.get("/api/auth/session")
  const result = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .set("X-CSRF-Token", initial.body.csrf)
    .send({ email: `${role}@test.invalid`, password })
  expect(result.status).toBe(200)
  return { agent, csrf: result.body.csrf }
}
beforeAll(async () => {
  const hash = await bcrypt.hash(password, 4)
  for (const role of ["admin", "staff"])
    await prisma.user.upsert({
      where: { email: `${role}@test.invalid` },
      create: {
        name: `Test ${role}`,
        email: `${role}@test.invalid`,
        role: role === "admin" ? "ADMIN" : "STAFF",
        passwordHash: hash,
      },
      update: { active: true, passwordHash: hash },
    })
})
beforeEach(async () => {
  await pool.query('DELETE FROM "RateLimit"')
})
afterAll(async () => {
  await prisma.lead.deleteMany()
  await prisma.jobApplication.deleteMany()
  await prisma.newsletterSubscriber.deleteMany()
  await disconnect()
})
describe("Public API and durable submissions", () => {
  it("reports real database health", async () => {
    const result = await request(app).get("/api/health")
    expect(result.status).toBe(200)
    expect(result.body.database).toBe("connected")
  })
  it("serves all published services and industries without private records", async () => {
    const result = await request(app).get("/api/content")
    expect(result.body.services).toHaveLength(15)
    expect(result.body.industries).toHaveLength(8)
    expect(result.body.leads).toBeUndefined()
    expect(result.body.users).toBeUndefined()
  })
  it("saves a lead with an accurate email status and survives another database connection", async () => {
    const data = leadData()
    const result = await request(app)
      .post("/api/leads")
      .set("Origin", origin)
      .send(data)
    expect(result.status).toBe(201)
    expect(result.body.reference).toMatch(/^HW-/)
    expect(result.body.emailStatus).toBe("not-configured")
    const separate = new PrismaClient()
    try {
      const saved = await separate.lead.findUnique({
        where: { submissionId: data.submissionId },
      })
      expect(saved?.email).toBe(data.email)
    } finally {
      await separate.$disconnect()
    }
  })
  it("handles duplicate submissions without duplicate records", async () => {
    const data = leadData()
    const first = await request(app)
      .post("/api/leads")
      .set("Origin", origin)
      .send(data)
    const second = await request(app)
      .post("/api/leads")
      .set("Origin", origin)
      .send(data)
    expect(second.body.reference).toBe(first.body.reference)
    expect(second.body.duplicate).toBe(true)
    expect(
      await prisma.lead.count({ where: { submissionId: data.submissionId } })
    ).toBe(1)
  })
  it("rejects conflicting idempotency tokens", async () => {
    const data = leadData()
    await request(app).post("/api/leads").set("Origin", origin).send(data)
    const result = await request(app)
      .post("/api/leads")
      .set("Origin", origin)
      .send({ ...data, email: "different@example.com" })
    expect(result.status).toBe(409)
  })
  it("returns useful server validation errors", async () => {
    const result = await request(app)
      .post("/api/leads")
      .set("Origin", origin)
      .send(leadData({ email: "bad", phone: "123" }))
    expect(result.status).toBe(400)
    expect(result.body.fields.email).toBeTruthy()
    expect(result.body.fields.phone).toBeTruthy()
  })
  it("rejects unknown services and spam", async () => {
    expect(
      (
        await request(app)
          .post("/api/leads")
          .set("Origin", origin)
          .send(leadData({ service: "Fake service" }))
      ).status
    ).toBe(400)
    expect(
      (
        await request(app)
          .post("/api/leads")
          .set("Origin", origin)
          .send(leadData({ companyFax: "bot" }))
      ).status
    ).toBe(400)
  })
  it("blocks untrusted request origins", async () =>
    expect(
      (
        await request(app)
          .post("/api/leads")
          .set("Origin", "https://evil.invalid")
          .send(leadData())
      ).status
    ).toBe(403))
  it("persists and deduplicates newsletter subscriptions", async () => {
    const data = { email: "subscriber@example.com", consent: true }
    await request(app).post("/api/newsletter").set("Origin", origin).send(data)
    await request(app).post("/api/newsletter").set("Origin", origin).send(data)
    expect(
      await prisma.newsletterSubscriber.count({ where: { email: data.email } })
    ).toBe(1)
    const sub = await prisma.newsletterSubscriber.findUniqueOrThrow({
      where: { email: data.email },
    })
    const result = await request(app)
      .post("/api/newsletter/unsubscribe")
      .set("Origin", origin)
      .send({ token: sub.unsubscribeToken })
    expect(result.status).toBe(200)
    expect(
      (
        await prisma.newsletterSubscriber.findUniqueOrThrow({
          where: { id: sub.id },
        })
      ).active
    ).toBe(false)
  })
  it("saves a career application", async () => {
    const result = await request(app)
      .post("/api/applications")
      .set("Origin", origin)
      .field("name", "Test applicant")
      .field("email", "applicant@example.com")
      .field("message", "I enjoy designing accessible digital experiences.")
      .field("consent", "true")
    expect(result.status).toBe(201)
    expect(
      await prisma.jobApplication.count({
        where: { email: "applicant@example.com" },
      })
    ).toBe(1)
  })
  it("rejects disguised executable résumé uploads", async () => {
    const result = await request(app)
      .post("/api/applications")
      .set("Origin", origin)
      .field("name", "Test applicant")
      .field("email", "badfile@example.com")
      .field("message", "I enjoy designing accessible digital experiences.")
      .field("consent", "true")
      .attach("resume", Buffer.from("<script>alert(1)</script>"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
    expect(result.status).toBe(400)
    expect(
      await prisma.jobApplication.count({
        where: { email: "badfile@example.com" },
      })
    ).toBe(0)
  })
  it("enforces database-backed public rate limits", async () => {
    for (let i = 0; i < 15; i++)
      await request(app)
        .post("/api/newsletter")
        .set("Origin", origin)
        .send({ email: "limit@example.com", consent: true })
    const result = await request(app)
      .post("/api/newsletter")
      .set("Origin", origin)
      .send({ email: "limit@example.com", consent: true })
    expect(result.status).toBe(429)
    expect(
      (await pool.query('SELECT hits FROM "RateLimit"')).rows[0].hits
    ).toBe(16)
  })
  it("returns safe unknown-endpoint and malformed-body errors", async () => {
    expect((await request(app).get("/api/unknown")).status).toBe(404)
    const result = await request(app)
      .post("/api/leads")
      .set("Origin", origin)
      .set("Content-Type", "application/json")
      .send("{invalid")
    expect(result.status).toBe(400)
    expect(result.body.error).not.toContain("SyntaxError")
  })
})
describe("Authentication, permissions and administration", () => {
  it.each([
    {
      entity: "industries",
      collection: "industries",
      field: "title",
      data: {
        slug: "audit-industry",
        title: "Audit industry",
        description: "Functional industry check",
        benefits: ["Connected systems"],
        body: "Industry content",
        published: true,
      },
    },
    {
      entity: "projects",
      collection: "projects",
      field: "title",
      data: {
        slug: "audit-project",
        title: "Audit project",
        description: "Functional project check",
        body: "Project content",
        industry: "Technology",
        services: ["Development"],
        serviceIds: ["service-0"],
        technologies: ["React"],
        cover: "/portfolio/commerce.svg",
        gallery: [],
        published: true,
      },
    },
    {
      entity: "categories",
      collection: "categories",
      field: "title",
      data: { slug: "audit-category", title: "Audit category" },
    },
    {
      entity: "tags",
      collection: "tags",
      field: "title",
      data: { slug: "audit-tag", title: "Audit tag" },
    },
    {
      entity: "faqs",
      collection: "faqs",
      field: "question",
      data: {
        question: "Audit question?",
        answer: "A saved answer.",
        published: true,
      },
    },
    {
      entity: "team",
      collection: "team",
      field: "name",
      data: {
        name: "Audit team member",
        role: "Engineer",
        bio: "Test biography",
        published: true,
      },
    },
    {
      entity: "jobs",
      collection: "jobs",
      field: "title",
      data: {
        slug: "audit-job",
        title: "Audit job",
        location: "Remote",
        type: "Full time",
        description: "Functional careers check",
        body: "Job content",
        published: true,
      },
    },
  ])(
    "creates, searches, updates, publishes and deletes $entity with audit records",
    async ({ entity, collection, field, data }) => {
      const { agent, csrf } = await login()
      const created = await agent
        .post(`/api/admin/${entity}`)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send(data)
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      const id = created.body.id
      try {
        const listed = await agent.get(`/api/admin/${entity}?search=Audit`)
        expect(listed.status).toBe(200)
        expect(
          listed.body.items.some((row: { id: string }) => row.id === id)
        ).toBe(true)
        const update = await agent
          .patch(`/api/admin/${entity}/${id}`)
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send({ [field]: "Audit updated content" })
        expect(update.status, JSON.stringify(update.body)).toBe(200)
        const published = (await request(app).get("/api/content")).body[
          collection
        ]
        expect(
          published.find((row: { id: string }) => row.id === id)?.[field]
        ).toBe("Audit updated content")
        if ("published" in data) {
          const hidden = await agent
            .patch(`/api/admin/${entity}/${id}`)
            .set("Origin", origin)
            .set("X-CSRF-Token", csrf)
            .send({ published: false })
          expect(hidden.status).toBe(200)
          expect(
            (await request(app).get("/api/content")).body[collection].some(
              (row: { id: string }) => row.id === id
            )
          ).toBe(false)
        }
      } finally {
        const deleted = await agent
          .delete(`/api/admin/${entity}/${id}`)
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
        expect(deleted.status).toBe(200)
      }
      expect(
        (await request(app).get("/api/content")).body[collection].some(
          (row: { id: string }) => row.id === id
        )
      ).toBe(false)
      const actions = (
        await prisma.auditLog.findMany({ where: { recordId: id } })
      ).map((row) => row.action)
      expect(actions).toEqual(
        expect.arrayContaining(["CREATE", "UPDATE", "DELETE"])
      )
    }
  )
  it("blocks unauthenticated access to all private data", async () => {
    for (const path of [
      "leads",
      "metrics",
      "users",
      "applications",
      "subscribers",
      "audit",
    ])
      expect((await request(app).get(`/api/admin/${path}`)).status).toBe(401)
  })
  it("sets HTTP-only sessions and logs out successfully", async () => {
    const { agent, csrf } = await login()
    expect((await agent.get("/api/auth/session")).body.user.role).toBe("ADMIN")
    const result = await agent
      .post("/api/auth/logout")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({})
    expect(result.status).toBe(200)
    expect((await agent.get("/api/admin/metrics")).status).toBe(401)
  })
  it("rejects bad credentials and enforces CSRF", async () => {
    const agent = request.agent(app)
    const initial = await agent.get("/api/auth/session")
    const result = await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .set("X-CSRF-Token", initial.body.csrf)
      .send({ email: "admin@test.invalid", password: "incorrect-password" })
    expect(result.status).toBe(401)
    const signed = await login()
    expect(
      (
        await signed.agent
          .post("/api/admin/categories")
          .set("Origin", origin)
          .send({ title: "Bad", slug: "bad" })
      ).status
    ).toBe(403)
  })
  it("prevents staff from escalating privileges or deleting content", async () => {
    const { agent, csrf } = await login("staff")
    for (const path of ["users", "settings", "media", "audit", "projects"])
      expect((await agent.get(`/api/admin/${path}`)).status).toBe(403)
    expect(
      (
        await agent
          .delete("/api/admin/categories/category-0")
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
      ).status
    ).toBe(403)
  })
  it("updates lead status, follow-up and team notes with an audit trail", async () => {
    const submitted = await request(app)
      .post("/api/leads")
      .set("Origin", origin)
      .send(leadData())
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { reference: submitted.body.reference },
    })
    const { agent, csrf } = await login("staff")
    const result = await agent
      .patch(`/api/admin/leads/${lead.id}`)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ status: "QUALIFIED", followUpAt: "2026-11-01T00:00:00.000Z" })
    expect(result.status).toBe(200)
    await agent
      .post(`/api/admin/leads/${lead.id}/notes`)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ body: "Discovery conversation planned." })
    const detail = await agent.get(`/api/admin/leads/${lead.id}`)
    expect(detail.body.notes[0].body).toBe("Discovery conversation planned.")
    expect(
      await prisma.auditLog.count({ where: { recordId: lead.id } })
    ).toBeGreaterThanOrEqual(2)
  })
  it("searches, filters, paginates and exports leads", async () => {
    const { agent } = await login()
    const result = await agent.get(
      "/api/admin/leads?search=Integration&status=QUALIFIED&page=1"
    )
    expect(result.status).toBe(200)
    expect(result.body.pageSize).toBe(15)
    expect(
      result.body.items.every(
        (row: { status: string }) => row.status === "QUALIFIED"
      )
    ).toBe(true)
    const csv = await agent.get("/api/admin/leads/export")
    expect(csv.headers["content-type"]).toContain("text/csv")
    expect(csv.text).toContain("reference")
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"')
  })
  it("allows service CRUD and rejects invalid records", async () => {
    const { agent, csrf } = await login()
    const service = await prisma.service.findFirstOrThrow()
    const {
      id: _id,
      createdAt: _created,
      updatedAt: _updated,
      ...base
    } = service
    const result = await agent
      .post("/api/admin/services")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({
        ...base,
        slug: "integration-service",
        title: "Integration service",
      })
    expect(result.status).toBe(201)
    const id = result.body.id
    expect(
      (
        await agent
          .patch(`/api/admin/services/${id}`)
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send({ title: "Updated service" })
      ).status
    ).toBe(200)
    expect(
      (
        await agent
          .patch(`/api/admin/services/${id}`)
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send({ slug: "../bad" })
      ).status
    ).toBe(400)
    expect(
      (
        await agent
          .delete(`/api/admin/services/${id}`)
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
      ).status
    ).toBe(200)
  })
  it("keeps draft and scheduled blog posts private and supports CRUD", async () => {
    const { agent, csrf } = await login("staff")
    const result = await agent
      .post("/api/admin/posts")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({
        title: "Private test draft",
        slug: "private-test-draft",
        description: "A draft for integration testing.",
        body: "## Safe content\nThis is an integration test.",
        status: "DRAFT",
        cover: "engineering",
        tagIds: ["tag-0"],
      })
    expect(result.status).toBe(201)
    const id = result.body.id
    expect(
      (await request(app).get("/api/content")).body.posts.some(
        (p: { id: string }) => p.id === id
      )
    ).toBe(false)
    await agent
      .patch(`/api/admin/posts/${id}`)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ status: "PUBLISHED", publishedAt: "2099-01-01T00:00:00.000Z" })
    expect(
      (await request(app).get("/api/content")).body.posts.some(
        (p: { id: string }) => p.id === id
      )
    ).toBe(false)
    await agent
      .patch(`/api/admin/posts/${id}`)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ publishedAt: "2020-01-01T00:00:00.000Z" })
    expect(
      (await request(app).get("/api/content")).body.posts.some(
        (p: { id: string }) => p.id === id
      )
    ).toBe(true)
    const admin = await login()
    expect(
      (
        await admin.agent
          .delete(`/api/admin/posts/${id}`)
          .set("Origin", origin)
          .set("X-CSRF-Token", admin.csrf)
      ).status
    ).toBe(200)
  })
  it("rejects unknown models and ignores privilege injection fields", async () => {
    const { agent, csrf } = await login("staff")
    expect((await agent.get("/api/admin/passwordHash")).status).toBe(404)
    const result = await agent
      .post("/api/admin/categories")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ title: "Safe category", slug: "safe-category", role: "ADMIN" })
    expect(result.status).toBe(201)
    expect(result.body.role).toBeUndefined()
    await prisma.blogCategory.delete({ where: { id: result.body.id } })
  })
  it("immediately revokes disabled staff access", async () => {
    const { agent } = await login("staff")
    await prisma.user.update({
      where: { email: "staff@test.invalid" },
      data: { active: false },
    })
    expect((await agent.get("/api/admin/leads")).status).toBe(401)
    await prisma.user.update({
      where: { email: "staff@test.invalid" },
      data: { active: true },
    })
  })
  it("preserves disabled accounts on name edits and revokes sessions on password reset", async () => {
    const { agent, csrf } = await login()
    const target = await prisma.user.create({
      data: {
        email: "patch-user@test.invalid",
        name: "Patch user",
        role: "STAFF",
        active: false,
        passwordHash: await bcrypt.hash(password, 4),
      },
    })
    try {
      const renamed = await agent
        .patch(`/api/admin/users/${target.id}`)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send({ name: "Renamed user" })
      expect(renamed.status).toBe(200)
      expect(renamed.body.active).toBe(false)
      expect(renamed.body.role).toBe("STAFF")
      await agent
        .patch(`/api/admin/users/${target.id}`)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send({ active: true })
      const staff = request.agent(app)
      const session = await staff.get("/api/auth/session")
      const signedIn = await staff
        .post("/api/auth/login")
        .set("Origin", origin)
        .set("X-CSRF-Token", session.body.csrf)
        .send({ email: target.email, password })
      expect(signedIn.status).toBe(200)
      expect((await staff.get("/api/admin/leads")).status).toBe(200)
      const changed = await agent
        .patch(`/api/admin/users/${target.id}`)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .send({ password: password + "-changed" })
      expect(changed.status).toBe(200)
      expect((await staff.get("/api/admin/leads")).status).toBe(401)
    } finally {
      await prisma.user.delete({ where: { id: target.id } })
    }
  })
  it("never returns password hashes or unsubscribe tokens in listings", async () => {
    const { agent } = await login()
    const users = await agent.get("/api/admin/users")
    expect(
      users.body.items.every(
        (row: Record<string, unknown>) => !row.passwordHash
      )
    ).toBe(true)
    const subscribers = await agent.get("/api/admin/subscribers")
    expect(
      subscribers.body.items.every(
        (row: Record<string, unknown>) => !row.unsubscribeToken
      )
    ).toBe(true)
  })
})
