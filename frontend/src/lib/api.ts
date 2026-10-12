export class ApiError extends Error {
  fields: Record<string, string>
  status: number
  constructor(
    message: string,
    status: number,
    fields: Record<string, string> = {}
  ) {
    super(message)
    this.status = status
    this.fields = fields
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const readOnly = ["GET", "HEAD"].includes(
    (options.method || "GET").toUpperCase()
  )
  const attempts = readOnly ? 2 : 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response
    try {
      response = await fetch(path, {
        ...options,
        credentials: "same-origin",
        headers: {
          ...(!(options.body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
      })
    } catch (error) {
      if (options.signal?.aborted) throw error
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        continue
      }
      throw new ApiError(
        "Cannot reach the server. Please try again in a moment.",
        503
      )
    }
    if ([502, 503, 504].includes(response.status) && attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      continue
    }
    let data
    try {
      data = await response.json()
    } catch {
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        continue
      }
      throw new ApiError(
        "The server is temporarily unavailable. Please try again in a moment.",
        response.ok ? 502 : response.status
      )
    }
    if (!response.ok)
      throw new ApiError(
        typeof data?.error === "string"
          ? data.error
          : "The request failed. Please try again.",
        response.status,
        data?.fields
      )
    return data as T
  }
  throw new ApiError(
    "The server is temporarily unavailable. Please try again.",
    503
  )
}
// Share the in-flight bootstrap request across Strict Mode's repeated effects.
// Two anonymous requests could otherwise set different cookies and CSRF tokens.
let sessionRequest: Promise<unknown> | undefined
export function getAuthSession<T>(): Promise<T> {
  sessionRequest ||= api("/api/auth/session").finally(() => {
    sessionRequest = undefined
  })
  return sessionRequest as Promise<T>
}
