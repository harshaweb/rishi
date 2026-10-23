import type { Content } from "../shared/content.js"
import { pageMetadata } from "../shared/seo.js"
import { renderPage } from "./render.js"
export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
export async function renderDocument(
  template: string,
  path: string,
  content: Content,
  base: string
) {
  const pathname = path.split("?")[0].replace(/\/+$/, "") || "/"
  const metadata = pageMetadata(pathname, content)
  let html = template.replace(
    /<title>.*?<\/title>/,
    () => `<title>${escapeHtml(metadata.title)}</title>`
  )
  const replaceContent = (pattern: RegExp, value: string) => {
    html = html.replace(
      pattern,
      (_match, prefix: string) => prefix + escapeHtml(value)
    )
  }
  replaceContent(
    /(<meta name="description" content=")[^"]*/,
    metadata.description
  )
  replaceContent(
    /(<meta name="robots" content=")[^"]*/,
    metadata.noindex ? "noindex, nofollow" : "index, follow"
  )
  for (const [key, value] of Object.entries({
    title: metadata.title,
    description: metadata.description,
    url: base + pathname,
    image: base + "/social-card.svg",
  }))
    replaceContent(
      new RegExp(`(<meta property="og:${key}" content=")[^"]*`),
      value
    )
  replaceContent(/(<link rel="canonical" href=")[^"]*/, base + pathname)
  html = html.replace(
    /data-base="[^"]*"/,
    () => `data-base="${escapeHtml(base)}"`
  )
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: metadata.title.endsWith("| Omshivraj") ? "Omshivraj" : "Harshaweb",
      url: base,
      ...(content.settings.contactEmail
        ? { email: content.settings.contactEmail }
        : {}),
    },
    ...(pathname.startsWith("/services/") && metadata.exists
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: metadata.title.split(" | ")[0],
            description: metadata.description,
            provider: { "@type": "Organization", name: "Harshaweb", url: base },
          },
        ]
      : []),
    ...(pathname !== "/" && metadata.exists && !metadata.noindex
      ? [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: base },
              {
                "@type": "ListItem",
                position: 2,
                name: metadata.title.split(" | ")[0],
                item: base + pathname,
              },
            ],
          },
        ]
      : []),
  ]
  const rendered = await renderPage(path, content)
  const safeJson = (value: unknown) =>
    JSON.stringify(value).replaceAll("<", "\\u003c")
  html = html.replace(
    '<div id="root"></div>',
    () =>
      `<div id="root">${rendered}</div><script type="application/json" id="initial-content">${safeJson(content)}</script><script type="application/ld+json">${safeJson(schema)}</script>`
  )
  return { html, metadata }
}
