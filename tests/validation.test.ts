import { describe, expect, it } from "vitest"
import {
  applicationSchema,
  leadSchema,
  newsletterSchema,
  entitySchemas,
} from "../server/validation"
const lead = {
  submissionId: crypto.randomUUID(),
  name: "Test visitor",
  email: "VISITOR@example.com",
  phone: "+91 98765 43210",
  company: "Test business",
  website: "",
  service: "Not sure yet",
  budget: "Let’s discuss",
  timeline: "Exploring options",
  message: "We need an accessible website for our business.",
  consent: true,
}
describe("Public input validation", () => {
  it("normalises email addresses and accepts a valid quote", () =>
    expect(leadSchema.parse(lead).email).toBe("visitor@example.com"))
  it.each(["wrong", "a@", ""])("rejects invalid email %s", (email) =>
    expect(leadSchema.safeParse({ ...lead, email }).success).toBe(false)
  )
  it("requires a country code and project context", () => {
    expect(leadSchema.safeParse({ ...lead, phone: "98765" }).success).toBe(
      false
    )
    expect(leadSchema.safeParse({ ...lead, message: "Hi" }).success).toBe(false)
  })
  it("requires explicit consent", () =>
    expect(leadSchema.safeParse({ ...lead, consent: false }).success).toBe(
      false
    ))
  it("rejects honeypot submissions", () =>
    expect(leadSchema.safeParse({ ...lead, companyFax: "bot" }).success).toBe(
      false
    ))
  it("rejects active URL schemes", () =>
    expect(
      leadSchema.safeParse({ ...lead, website: "javascript:alert(1)" }).success
    ).toBe(false))
  it("validates newsletter consent", () =>
    expect(
      newsletterSchema.safeParse({ email: "news@example.com", consent: false })
        .success
    ).toBe(false))
  it("validates applications", () =>
    expect(
      applicationSchema.safeParse({
        name: "Name",
        email: "bad",
        message: "Short",
        consent: true,
      }).success
    ).toBe(false))
  it("rejects invalid content slugs and public media URLs", () => {
    expect(
      entitySchemas.categories.safeParse({ title: "Test", slug: "../admin" })
        .success
    ).toBe(false)
    expect(
      entitySchemas.team.safeParse({
        name: "Name",
        role: "Role",
        bio: "Bio",
        photo: "https://tracker.invalid/a.png",
      }).success
    ).toBe(false)
  })
})
