import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { api } from "./api"
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}
type AnalyticsConfig = { ga4: string; gtm: string }
let configured: AnalyticsConfig | null = null
let loading: Promise<void> | null = null
const allowed = () => localStorage.getItem("harshaweb-consent") === "optional"
async function enable() {
  if (!allowed() || configured) return
  if (loading) return loading
  loading = (async () => {
    const config = await api<AnalyticsConfig>("/api/analytics-config")
    if (!allowed()) return
    configured = config
    if (!config.ga4 && !config.gtm) return
    window.dataLayer ||= []
    window.gtag = (...args: unknown[]) => window.dataLayer!.push(args)
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
    const script = document.createElement("script")
    script.async = true
    script.id = "harshaweb-analytics"
    if (config.gtm) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" })
      script.src = `https://www.googletagmanager.com/gtm.js?id=${config.gtm}`
    } else {
      window.gtag("js", new Date())
      window.gtag("config", config.ga4, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      })
      script.src = `https://www.googletagmanager.com/gtag/js?id=${config.ga4}`
    }
    script.onerror = () =>
      console.error("Optional analytics script could not be loaded.")
    document.head.appendChild(script)
  })()
    .catch((error) => {
      console.error(
        "Optional analytics could not be configured.",
        error instanceof Error ? error.message : "Network error"
      )
    })
    .finally(() => {
      loading = null
    })
  return loading
}
export function trackEvent(name: "generate_lead" | "newsletter_signup") {
  if (!allowed() || !configured) return
  if (configured.gtm) window.dataLayer?.push({ event: name })
  else if (configured.ga4) window.gtag?.("event", name)
}
export function resetConsent() {
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0]
    if (name.startsWith("_ga") || name.startsWith("_gcl")) {
      document.cookie = `${name}=; Max-Age=0; path=/`
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`
    }
  }
  localStorage.removeItem("harshaweb-consent")
  window.location.reload()
}
export function Analytics() {
  const { pathname } = useLocation()
  useEffect(() => {
    const send = async () => {
      if (pathname.startsWith("/admin") || !allowed()) return
      await enable()
      if (!allowed() || !configured) return
      if (configured.gtm)
        window.dataLayer?.push({
          event: "virtual_page_view",
          page_path: pathname,
        })
      else if (configured.ga4)
        window.gtag?.("event", "page_view", {
          page_location: `${location.origin}${pathname}`,
          page_path: pathname,
        })
    }
    void send()
    window.addEventListener("harshaweb-consent", send)
    return () => window.removeEventListener("harshaweb-consent", send)
  }, [pathname])
  return null
}
