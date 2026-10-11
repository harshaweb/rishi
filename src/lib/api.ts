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
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(!(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  })
  const data = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response." }))
  if (!response.ok)
    throw new ApiError(
      data.error || "The request failed. Please try again.",
      response.status,
      data.fields
    )
  return data as T
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
