import { renderToPipeableStream } from "react-dom/server"
import { PassThrough } from "node:stream"
import { MemoryRouter } from "react-router-dom"
import { Website } from "../src/website.js"
import type { Content } from "../shared/content.js"
export function renderPage(path: string, content: Content): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    const chunks: Buffer[] = []
    let failed = false
    output.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    output.on("end", () =>
      failed
        ? reject(new Error("Server rendering failed"))
        : resolve(Buffer.concat(chunks).toString("utf8"))
    )
    output.on("error", reject)
    const stream = renderToPipeableStream(
      <MemoryRouter initialEntries={[path]}>
        <Website initial={content} />
      </MemoryRouter>,
      {
        onAllReady() {
          stream.pipe(output)
        },
        onShellError: reject,
        onError(error) {
          failed = true
          console.error(
            "Server rendering failed",
            error instanceof Error ? error.name : "Unknown error"
          )
        },
      }
    )
    const timeout = setTimeout(() => {
      stream.abort()
      reject(new Error("Server render timeout"))
    }, 10000)
    output.on("close", () => clearTimeout(timeout))
  })
}
