import type { settings } from "./content"

export function videoSource(
  value: string
): { kind: "file" | "embed"; src: string } | null {
  if (/^\/videos\/[a-zA-Z0-9_-]+\.(mp4|webm)$/.test(value))
    return { kind: "file", src: value }
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) return null
    const host = url.hostname.toLowerCase()
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      const id =
        host === "youtu.be"
          ? url.pathname.slice(1)
          : url.searchParams.get("v") ||
            url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
      return id && /^[\w-]{11}$/.test(id)
        ? {
            kind: "embed",
            src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
          }
        : null
    }
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const id = url.pathname.match(/^\/(?:video\/)?(\d+)$/)?.[1]
      return id
        ? { kind: "embed", src: `https://player.vimeo.com/video/${id}?dnt=1` }
        : null
    }
  } catch {
    /* Invalid URLs are rejected by the settings form and API. */
  }
  return null
}
export function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Harshaweb, I would like to discuss a project.")}`
}
export function configuredVideos(values: typeof settings) {
  return [1, 2, 3].flatMap((index) => {
    const get = (suffix: string) =>
      values[`video${index}${suffix}` as keyof typeof values] || ""
    const source = videoSource(get("Url"))
    return source && get("Title")
      ? [
          {
            id: `video-${index}`,
            title: get("Title"),
            description: get("Description"),
            transcript: get("Transcript"),
            source,
          },
        ]
      : []
  })
}
