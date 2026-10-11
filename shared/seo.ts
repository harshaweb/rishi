import type { Content } from "./content"
export const publicRoutes = [
  "/",
  "/about",
  "/vision-and-mission",
  "/team",
  "/process",
  "/portfolio",
  "/industries",
  "/technology",
  "/careers",
  "/resources",
  "/videos",
  "/book-a-consultation",
  "/site-map",
  "/contact",
  "/request-a-quote",
  "/privacy-policy",
  "/terms-and-conditions",
  "/cookie-policy",
]
const names: Record<string, string> = {
  "/": "Technology that moves your business forward",
  "/about": "About Harshaweb",
  "/vision-and-mission": "Our vision & mission",
  "/team": "Our team",
  "/process": "Our development process",
  "/portfolio": "Portfolio & project studies",
  "/industries": "Industries we serve",
  "/technology": "Technology stack",
  "/careers": "Careers at Harshaweb",
  "/resources": "Insights & resources",
  "/videos": "Videos & process overview",
  "/book-a-consultation": "Book a consultation",
  "/site-map": "Website sitemap",
  "/contact": "Contact us",
  "/request-a-quote": "Request a project quote",
  "/privacy-policy": "Privacy Policy",
  "/terms-and-conditions": "Terms & Conditions",
  "/cookie-policy": "Cookie Policy",
  "/services": "Web, application & digital growth services",
  "/unsubscribe": "Newsletter preferences",
  "/blog": "Insights & resources",
  "/enquiry/website": "Website project enquiry",
  "/enquiry/application": "Application project enquiry",
  "/enquiry/marketing": "Digital marketing enquiry",
}
export function pageMetadata(pathname: string, content: Content) {
  const parts = pathname.split("/").filter(Boolean)
  const collection =
    parts[0] === "services"
      ? content.services
      : parts[0] === "industries"
        ? content.industries
        : parts[0] === "portfolio"
          ? content.projects
          : parts[0] === "resources"
            ? content.posts
            : []
  const detail =
    parts.length === 2
      ? collection.find((item) => item.slug === parts[1])
      : undefined
  const exists = Boolean(
    names[pathname] || detail || pathname.startsWith("/admin")
  )
  const title = detail
    ? detail.seoTitle || detail.title
    : names[pathname] ||
      (pathname.startsWith("/admin") ? "Staff workspace" : "Page not found")
  const description = detail
    ? detail.seoDescription || detail.description
    : pathname === "/"
      ? content.settings.heroDescription
      : `${title}. Explore thoughtful design, dependable engineering and connected digital services from Harshaweb.`
  return {
    title: `${title} | Harshaweb`,
    description: description.slice(0, 180),
    exists,
    noindex:
      !exists || pathname.startsWith("/admin") || pathname === "/unsubscribe",
  }
}
export function allPublicRoutes(content: Content) {
  return [
    ...publicRoutes,
    "/services",
    ...content.services.map((s) => `/services/${s.slug}`),
    ...content.industries.map((s) => `/industries/${s.slug}`),
    ...content.projects.map((s) => `/portfolio/${s.slug}`),
    ...content.posts.map((s) => `/resources/${s.slug}`),
  ]
}
