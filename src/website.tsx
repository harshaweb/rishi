import {
  Component,
  Suspense,
  lazy,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { RentalApp, isRentalPath } from "./pages/rentals"
import { Analytics } from "./lib/analytics"
import { ContentProvider, useContent } from "./lib/content"
import type { Content } from "../shared/content"
import { pageMetadata } from "../shared/seo"
import { CookieChoice, Footer, Header } from "./components/layout"
import { Home } from "./pages/home"
import { ContactWidget } from "./components/engagement"
const VisionMission = lazy(() =>
  import("./pages/engagement").then((m) => ({ default: m.VisionMission }))
)
const Videos = lazy(() =>
  import("./pages/engagement").then((m) => ({ default: m.Videos }))
)
const Consultation = lazy(() =>
  import("./pages/engagement").then((m) => ({ default: m.Consultation }))
)
const SiteMap = lazy(() =>
  import("./pages/engagement").then((m) => ({ default: m.SiteMap }))
)
const About = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.About }))
)
const ArticleDetail = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.ArticleDetail }))
)
const Careers = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Careers }))
)
const Contact = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Contact }))
)
const Industries = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Industries }))
)
const IndustryDetail = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.IndustryDetail }))
)
const Legal = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Legal }))
)
const NotFound = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.NotFound }))
)
const Portfolio = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Portfolio }))
)
const Process = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Process }))
)
const ProjectDetail = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.ProjectDetail }))
)
const Resources = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Resources }))
)
const ServiceDetail = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.ServiceDetail }))
)
const Services = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Services }))
)
const Team = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Team }))
)
const Technology = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Technology }))
)
const Unsubscribe = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Unsubscribe }))
)
const Admin = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.Admin }))
)
function Metadata() {
  const { pathname } = useLocation()
  const { content } = useContent()
  useEffect(() => {
    const meta = pageMetadata(pathname, content)
    document.title = meta.title
    function set(selector: string, value: string) {
      document.querySelector(selector)?.setAttribute("content", value)
    }
    set('meta[name="description"]', meta.description)
    set('meta[property="og:title"]', meta.title)
    set('meta[property="og:description"]', meta.description)
    set(
      'meta[name="robots"]',
      meta.noindex ? "noindex, nofollow" : "index, follow"
    )
    const canonical = document.querySelector('link[rel="canonical"]')
    const base = canonical?.getAttribute("data-base") || window.location.origin
    canonical?.setAttribute("href", base + pathname)
    set('meta[property="og:url"]', base + pathname)
  }, [pathname, content])
  return null
}
function Site() {
  const { pathname } = useLocation()
  const { content } = useContent()
  if (isRentalPath(pathname)) return <><Metadata /><RentalApp /></>
  if (pathname.startsWith("/admin"))
    return (
      <>
        <Metadata />
        <Admin />
      </>
    )
  return (
    <>
      <Metadata />
      <Analytics />
      <Header key={`header:${pathname}`} />
      {content.settings.maintenanceNotice && (
        <div className="system-notice" role="status">
          {content.settings.maintenanceNotice}
        </div>
      )}
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/industries" element={<Industries />} />
          <Route path="/industries/:slug" element={<IndustryDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/portfolio/:slug" element={<ProjectDetail />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/book-a-consultation" element={<Consultation />} />
          <Route path="/site-map" element={<SiteMap />} />
          <Route path="/blog" element={<Resources />} />
          <Route path="/resources/:slug" element={<ArticleDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/vision-and-mission" element={<VisionMission />} />
          <Route path="/team" element={<Team />} />
          <Route path="/process" element={<Process />} />
          <Route path="/technology" element={<Technology />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/request-a-quote" element={<Contact quote />} />
          <Route
            path="/enquiry/website"
            element={<Contact quote kind="website" />}
          />
          <Route
            path="/enquiry/application"
            element={<Contact quote kind="application" />}
          />
          <Route
            path="/enquiry/marketing"
            element={<Contact quote kind="marketing" />}
          />
          <Route path="/privacy-policy" element={<Legal policy="privacy" />} />
          <Route
            path="/terms-and-conditions"
            element={<Legal policy="terms" />}
          />
          <Route path="/cookie-policy" element={<Legal policy="cookies" />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <CookieChoice />
      <ContactWidget key={`contact-widget:${pathname}`} />
    </>
  )
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Website rendering failed", error.name, info.componentStack)
  }
  render() {
    return this.state.failed ? (
      <main className="not-found container">
        <h1>Something interrupted this page.</h1>
        <p>
          Please reload to try again. Your saved submissions remain in the
          database.
        </p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </main>
    ) : (
      this.props.children
    )
  }
}
export function Website({ initial }: { initial?: Content }) {
  return (
    <ErrorBoundary>
      <ContentProvider initial={initial}>
        <Suspense
          fallback={
            <div className="section container" role="status">
              Loading your next perspective…
            </div>
          }
        >
          <Site />
        </Suspense>
      </ContentProvider>
    </ErrorBoundary>
  )
}
