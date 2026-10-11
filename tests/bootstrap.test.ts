import { afterEach, expect, it, vi } from "vitest"
import handler, { configurationProblems } from "../api/index.js"

afterEach(() => vi.unstubAllEnvs())

it("identifies invalid production configuration without exposing its values", () => {
  expect(configurationProblems({ NODE_ENV: "production" })).toEqual([
    "DATABASE_URL",
    "SESSION_SECRET",
    "SITE_URL",
  ])
  expect(
    configurationProblems({
      NODE_ENV: "production",
      DATABASE_URL: "https://example.com",
      SESSION_SECRET: "short-secret",
      SITE_URL: "http://localhost:5173",
    })
  ).toEqual(["DATABASE_URL", "SESSION_SECRET", "SITE_URL"])
  expect(
    configurationProblems({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@database.example/app",
      SESSION_SECRET: "a".repeat(32),
      SITE_URL: "https://rishi-five-beta.vercel.app",
    })
  ).toEqual([])
})

it("returns a controlled API failure when required settings are absent", async () => {
  vi.stubEnv("MONGODB_URL", "")
  vi.stubEnv("DATABASE_URL", "")
  vi.stubEnv("SESSION_SECRET", "")
  vi.stubEnv("SITE_URL", "")
  vi.stubEnv("NODE_ENV", "production")
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() }
  await handler({ url: "/api/health" }, res)
  expect(res.statusCode).toBe(503)
  expect(JSON.parse(res.end.mock.calls[0][0])).toMatchObject({
    status: "unavailable",
    code: "SERVER_CONFIGURATION_ERROR",
    invalidSettings: ["DATABASE_URL", "SESSION_SECRET", "SITE_URL"],
  })
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store")
})

it("serves a readable unavailable page without leaking configuration details", async () => {
  vi.stubEnv("MONGODB_URL", "")
  vi.stubEnv("DATABASE_URL", "")
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() }
  await handler({ url: "/services" }, res)
  expect(res.statusCode).toBe(503)
  const html = res.end.mock.calls[0][0]
  expect(html).toContain("We’ll be back shortly.")
  expect(html).not.toContain("DATABASE_URL")
})

it("accepts named MongoDB databases and rejects template credentials or missing database names", () => {
  const env = { SESSION_SECRET: "a".repeat(32) }
  expect(
    configurationProblems({
      ...env,
      MONGODB_URL: "mongodb+srv://user:password@cluster.example/harshaweb",
    })
  ).toEqual([])
  expect(
    configurationProblems({
      ...env,
      DATABASE_URL: "mongodb://localhost:27017/harshaweb",
    })
  ).toEqual([])
  expect(
    configurationProblems({
      ...env,
      MONGODB_URL:
        "mongodb+srv://<db_username>:<db_password>@cluster.example/harshaweb",
    })
  ).toContain("DATABASE_URL")
  expect(
    configurationProblems({
      ...env,
      MONGODB_URL:
        "mongodb+srv://user:password@cluster.example/?appName=Cluster0",
    })
  ).toContain("DATABASE_URL")
})
