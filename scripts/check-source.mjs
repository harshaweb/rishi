import { access } from "node:fs/promises"
const required = [
  "src/main.tsx",
  "src/website.tsx",
  "src/pages/public.tsx",
  "server/app.ts",
  "server/http.ts",
  "server/render.tsx",
  "shared/content.ts",
  "shared/seo.ts",
  "prisma/schema.prisma",
  "prisma/migrations",
  "public/favicon.svg",
  "api/index.js",
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
