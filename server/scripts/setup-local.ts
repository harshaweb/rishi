import { randomBytes } from "node:crypto"
import { access, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
export async function setupLocal() {
  try {
    await access(".env")
    return
  } catch {
    /* A new local environment is created only if none exists. */
  }
  const secret = randomBytes(48).toString("hex")
  await writeFile(
    ".env",
    `# Generated local development credentials. Never use in production.\nMONGODB_URI=mongodb://127.0.0.1:27018/omshivraj?replicaSet=omshivraj-local\nSESSION_SECRET=${secret}\nSITE_URL=http://localhost:5173\nPORT=3001\nNODE_ENV=development\n`,
    { flag: "wx", mode: 0o600 }
  )
  console.log("Created ignored .env with random local credentials.")
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await setupLocal()
