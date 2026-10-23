import { afterAll, beforeAll, beforeEach, expect, it } from "vitest"
import request from "supertest"
import bcrypt from "bcryptjs"
import { app, apiError } from "../src/app"
import { disconnect, pool, prisma } from "../src/db"
app.use(apiError)
const origin = "http://localhost:5173"
const password = process.env.TEST_ADMIN_PASSWORD!
const ids: string[] = []
beforeAll(async () => {
  const passwordHash = await bcrypt.hash(password, 4)
  await prisma.user.upsert({
    where: { email: "upload-admin@test.invalid" },
    create: {
      email: "upload-admin@test.invalid",
      name: "Upload test operator",
      role: "ADMIN",
      passwordHash,
    },
    update: { active: true, passwordHash },
  })
})
beforeEach(async () => {
  await pool.query('DELETE FROM "RateLimit"')
})
afterAll(async () => {
  const { removeStored } = await import("../src/storage")
  for (const id of ids) {
    const asset = await prisma.mediaAsset.findUnique({ where: { id } })
    if (asset) {
      await prisma.jobApplication.deleteMany({ where: { resumeId: id } })
      await prisma.mediaAsset.delete({ where: { id } })
      await removeStored(asset.key)
    }
  }
  await disconnect()
})
it("stores an actual image and keeps a résumé private", async () => {
  const agent = request.agent(app)
  const session = await agent.get("/api/auth/session")
  const auth = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .set("X-CSRF-Token", session.body.csrf)
    .send({ email: "upload-admin@test.invalid", password })
  expect(auth.status).toBe(200)
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6l8AAAAASUVORK5CYII=",
    "base64"
  )
  const uploaded = await agent
    .post("/api/admin/media")
    .set("Origin", origin)
    .set("X-CSRF-Token", auth.body.csrf)
    .field("alt", "Integration test image")
    .attach("image", image, { filename: "test.png", contentType: "image/png" })
  expect(uploaded.status).toBe(201)
  ids.push(uploaded.body.id)
  const publicImage = await request(app).get(uploaded.body.path)
  expect(publicImage.status).toBe(200)
  expect(publicImage.headers["content-type"]).toContain("image/png")
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"
  )
  const application = await request(app)
    .post("/api/applications")
    .set("Origin", origin)
    .field("name", "Private file applicant")
    .field("email", "private-file@test.invalid")
    .field("message", "This is a private résumé integration test submission.")
    .field("consent", "true")
    .attach("resume", pdf, {
      filename: "resume.pdf",
      contentType: "application/pdf",
    })
  expect(application.status).toBe(201)
  const record = await prisma.jobApplication.findFirstOrThrow({
    where: { email: "private-file@test.invalid" },
    orderBy: { createdAt: "desc" },
  })
  ids.push(record.resumeId!)
  expect((await request(app).get(`/media/${record.resumeId}`)).status).toBe(404)
  expect(
    (await request(app).get(`/api/admin/media/${record.resumeId}/file`)).status
  ).toBe(401)
  const download = await agent.get(`/api/admin/media/${record.resumeId}/file`)
  expect(download.status).toBe(200)
  expect(download.headers["content-disposition"]).toContain("attachment")
})
it("rejects active PDF content", async () => {
  const pdf = Buffer.from(
    "%PDF-1.4\n<< /Type /Catalog /OpenAction /JavaScript >>\n%%EOF"
  )
  const result = await request(app)
    .post("/api/applications")
    .set("Origin", origin)
    .field("name", "Invalid file applicant")
    .field("email", "invalid-file@test.invalid")
    .field("message", "This is a private résumé integration test submission.")
    .field("consent", "true")
    .attach("resume", pdf, {
      filename: "resume.pdf",
      contentType: "application/pdf",
    })
  expect(result.status).toBe(400)
})
