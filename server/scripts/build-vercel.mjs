import { nodeFileTrace } from "@vercel/nft"
import { cp, mkdir, readFile, writeFile, rm, stat } from "node:fs/promises"
import { resolve, dirname, relative, sep } from "node:path"
const root = resolve(".")
const output = resolve(".vercel/output")
if (
  !output.startsWith(root + sep) ||
  relative(root, output).replaceAll("\\", "/") !== ".vercel/output"
)
  throw Error("Unsafe build output path")
await rm(output, { recursive: true, force: true })
const fn = resolve(output, "functions/server.func")
await mkdir(fn, { recursive: true })
const { fileList } = await nodeFileTrace(
  ["server/api/index.js", "dist-server/http.js"],
  {
    base: root,
    processCwd: root,
    ignore: [".env", ".env.*", ".data/**", ".vercel/**"],
  }
)
let bytes = 0,
  count = 0
for (const file of new Set([...fileList, "dist/index.html", "package.json"])) {
  const path = file.replaceAll("\\", "/")
  if (
    !["server/api/", "dist-server/", "node_modules/", "dist/index.html"].some(
      (prefix) => path.startsWith(prefix)
    ) &&
    path !== "package.json"
  )
    continue
  const from = resolve(root, file),
    to = resolve(fn, file)
  if (
    !from.startsWith(root + sep) ||
    !to.startsWith(fn + sep) ||
    /\/\.env(?:\.|$)/.test(path)
  )
    throw Error("Unsafe function file")
  if (!(await stat(from)).isFile()) continue
  await mkdir(dirname(to), { recursive: true })
  await cp(from, to)
  bytes += (await stat(from)).size
  count++
}
await writeFile(
  resolve(fn, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs24.x",
      handler: "server/api/index.js",
      launcherType: "Nodejs",
      shouldAddHelpers: true,
      maxDuration: 60,
    },
    null,
    2
  )
)
await cp("dist", resolve(output, "static"), {
  recursive: true,
  filter: (source) => resolve(source) !== resolve("dist/index.html"),
})
await writeFile(
  resolve(output, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/server" }],
    },
    null,
    2
  )
)
const pkg = JSON.parse(await readFile(resolve(fn, "package.json"), "utf8"))
if (pkg.type !== "module")
  throw Error("Function must preserve ESM package type")
console.log(
  `Vercel function packaged: ${count} files, ${Math.round(bytes / 1024 / 1024)} MB. Frontend assets packaged separately.`
)
