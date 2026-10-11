import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { prisma, disconnect } from "../server/db"
import { notifyLead } from "../server/mail"
const original = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL,
}
beforeAll(() => {
  process.env.RESEND_API_KEY = "test-provider-key"
  process.env.EMAIL_FROM = "test@example.com"
  process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.com"
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
afterAll(async () => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  await prisma.lead.deleteMany({ where: { kind: "mail-test" } })
  await disconnect()
})
async function lead() {
  return prisma.lead.create({
    data: {
      submissionId: crypto.randomUUID(),
      reference: `MAIL-${crypto.randomUUID()}`,
      name: "Mail test",
      email: "visitor@example.com",
      phone: "+91 98765 43210",
      company: "Test",
      service: "Not sure yet",
      budget: "Let’s discuss",
      timeline: "Exploring options",
      message: "Email notification integration test.",
      kind: "mail-test",
      consentAt: new Date(),
    },
  })
}
describe("Email provider response handling (mocked transport, not live delivery)", () => {
  it("records provider acceptance only when both messages are accepted", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetch)
    const row = await lead()
    expect(await notifyLead(row)).toBe("provider-accepted")
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(
      (await prisma.lead.findUniqueOrThrow({ where: { id: row.id } }))
        .emailStatus
    ).toBe("provider-accepted")
  })
  it("records partial notification failure accurately", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
    )
    expect(await notifyLead(await lead())).toBe("partial")
  })
  it("keeps the lead when the provider fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Provider unavailable"))
    )
    const row = await lead()
    expect(await notifyLead(row)).toBe("failed")
    expect(await prisma.lead.count({ where: { id: row.id } })).toBe(1)
  })
})
