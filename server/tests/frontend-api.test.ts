import { afterEach, expect, it, vi } from "vitest"
import { api } from "../../frontend/src/lib/api"

afterEach(() => vi.unstubAllGlobals())

it("recovers a session read after a brief gateway failure", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(Response.json({ user: null, csrf: "test-token" }))
  vi.stubGlobal("fetch", fetch)
  expect(await api("/api/rental/session")).toMatchObject({ user: null })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it("does not retry a login write after an ambiguous response", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("", { status: 502 }))
  vi.stubGlobal("fetch", fetch)
  await expect(
    api("/api/rental/login", { method: "POST" })
  ).rejects.toMatchObject({
    status: 502,
    message: expect.stringContaining("temporarily unavailable"),
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("rejects an HTML success response instead of treating it as session data", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response("<html>Wrong server</html>"))
      )
  )
  await expect(api("/api/rental/session")).rejects.toMatchObject({
    status: 502,
  })
})

it("preserves authentication errors without retrying", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ error: "Invalid email or password." }, { status: 401 })
    )
  vi.stubGlobal("fetch", fetch)
  await expect(
    api("/api/rental/login", { method: "POST" })
  ).rejects.toMatchObject({
    status: 401,
    message: "Invalid email or password.",
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})
