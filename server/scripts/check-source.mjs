import { access } from "node:fs/promises"
const required = [
  "frontend/src/main.tsx",
  "frontend/src/website.tsx",
  "frontend/src/pages/public.tsx",
  "server/src/app.ts",
  "server/src/http.ts",
  "server/src/render.tsx",
  "server/shared/content.ts",
  "server/shared/seo.ts",
  "server/prisma/schema.prisma",
  "server/prisma/migrations",
  "frontend/public/favicon.svg",
  "server/api/index.js",
]
const missing = []
for (const path of required) {
  try {
    await access(path)
  } catch {
    missing.push(path)
  }
}
if (missing.length) {
  console.error(
    `Incomplete source checkout. Missing:\n${missing.map((path) => `  ${path}`).join("\n")}\nCommit the complete src, server, shared, prisma, public, scripts and api directories. In Vercel, select the repository root as Root Directory.`
  )
  process.exit(1)
}
console.log("Complete application source verified.")
