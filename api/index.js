// Load the backend inside the request boundary so a startup failure returns a
// controlled response instead of terminating the serverless invocation.
let application

export function configurationProblems(env = process.env) {
  const problems = []
  try {
    const connection = env.MONGODB_URL || env.DATABASE_URL || ""
    const database = new URL(connection)
    const mongo = ["mongodb:", "mongodb+srv:"].includes(database.protocol)
    if (
      /[<>]/.test(connection) ||
      (mongo
        ? database.pathname.length <= 1
        : !["postgres:", "postgresql:"].includes(database.protocol))
    )
      problems.push("DATABASE_URL")
  } catch {
    problems.push("DATABASE_URL")
  }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    problems.push("SESSION_SECRET")
  if (env.NODE_ENV === "production") {
    try {
      if (new URL(env.SITE_URL || "").protocol !== "https:")
        problems.push("SITE_URL")
    } catch {
      problems.push("SITE_URL")
    }
  }
  return problems
}

export default async function handler(req, res) {
  const invalidSettings = configurationProblems()
  let code = "SERVER_CONFIGURATION_ERROR"
  if (!invalidSettings.length) {
    try {
      application ||= import("../dist-server/http.js").then(
        (module) => module.app
      )
      const app = await application
      return app(req, res)
    } catch (error) {
      application = undefined
      code = "SERVER_STARTUP_FAILED"
      // Never log environment values or Zod's full error, which can contain input.
      console.error("Backend startup failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: typeof error?.code === "string" ? error.code : undefined,
        fields: Array.isArray(error?.issues)
          ? error.issues.map((issue) => issue.path.join("."))
          : undefined,
      })
    }
  }
  res.statusCode = 503
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Retry-After", "60")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
  if ((req.url || "").split("?")[0].startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(
      JSON.stringify({
        status: "unavailable",
        code,
        error:
          "The website service is temporarily unavailable. Please try again later.",
        ...(invalidSettings.length ? { invalidSettings } : {}),
      })
    )
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.end(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Harshaweb — Temporarily unavailable</title></head><body><main><h1>We’ll be back shortly.</h1><p>The website service is temporarily unavailable. Please try again later.</p><button onclick="location.reload()">Try again</button></main></body></html>'
    )
  }
}
