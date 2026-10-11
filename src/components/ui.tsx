import {
  ArrowUpRight,
  ArrowRight,
  Code2,
  Globe2,
  Layers3,
  Palette,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Smartphone,
  ShoppingBag,
  Settings2,
  Braces,
  Workflow,
  Search,
  Megaphone,
  Compass,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useLocation } from "react-router-dom"
import { useSectionCopy } from "./managed-section"
import type { ReactNode } from "react"
export const serviceIcons: LucideIcon[] = [
  Globe2,
  Code2,
  ShoppingBag,
  Smartphone,
  Layers3,
  Workflow,
  Braces,
  Palette,
  Sparkles,
  TrendingUp,
  Search,
  Megaphone,
  Search,
  Settings2,
  Compass,
]
export function ButtonLink({
  to,
  children,
  secondary = false,
  dark = false,
  className = "",
}: {
  to: string
  children: ReactNode
  secondary?: boolean
  dark?: boolean
  className?: string
}) {
  return (
    <Link
      className={`button ${secondary ? "button-secondary" : ""} ${dark ? "on-dark" : ""} ${className}`}
      to={to}
    >
      {children}
      <ArrowUpRight size={17} />
    </Link>
  )
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow">
      <span />
      {children}
    </p>
  )
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  to,
  label = "Explore more",
}: {
  eyebrow: string
  title: string
  description?: string
  to?: string
  label?: string
}) {
  return (
    <div className="section-heading">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {to && (
        <Link className="text-link" to={to}>
          {label}
          <ArrowUpRight size={18} />
        </Link>
      )}
    </div>
  )
}
export function Breadcrumbs({
  items,
}: {
  items: { title: string; to?: string }[]
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      {items.map((item, i) => (
        <span key={i}>
          <span aria-hidden="true">/</span>
          {item.to ? (
            <Link to={item.to}>{item.title}</Link>
          ) : (
            <span aria-current="page">{item.title}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
  className?: string
}) {
  const { pathname } = useLocation()
  const copy = useSectionCopy(`hero:${pathname}`)
  return (
    <section className={`page-hero ${className}`}>
      <div className="container">
        <Breadcrumbs items={[{ title: eyebrow }]} />
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{copy.title || title}</h1>
        <p>{copy.description || description}</p>
        {children}
      </div>
      <div className="page-hero-orbit" aria-hidden="true" />
    </section>
  )
}
export function CTA() {
  const copy = useSectionCopy("cta")
  return (
    <section className="cta-band container">
      <div>
        <Eyebrow>LET’S MAKE IT HAPPEN</Eyebrow>
        <h2>{copy.title || "What’s your next big idea?"}</h2>
        <p>
          {copy.description ||
            "Let’s give it the right design, technology and direction."}
        </p>
      </div>
      <ButtonLink to="/request-a-quote">Discuss your project</ButtonLink>
    </section>
  )
}
export function FaqList({
  items,
}: {
  items: { id: string; question: string; answer: string }[]
}) {
  return (
    <div className="faq-list">
      {items.map((f, i) => (
        <details key={f.id}>
          <summary>
            <span className="faq-index">0{i + 1}</span>
            {f.question}
            <span className="faq-plus" aria-hidden="true">
              +
            </span>
          </summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  )
}
export function ProjectArt({
  kind,
  large = false,
  alt = "Project preview",
}: {
  kind: string
  large?: boolean
  alt?: string
}) {
  const previews: Record<string, string> = {
    commerce: "/portfolio/forma-commerce.png",
    workspace: "/portfolio/orbit-workspace.png",
  }
  const source = kind.startsWith("/media/") ? kind : previews[kind]
  if (source)
    return (
      <img
        className={`project-image ${large ? "large" : ""}`}
        src={source}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    )
  return (
    <div
      className={`project-art ${kind} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      {kind === "commerce" ? (
        <div className="store-mock">
          <div className="mock-top">
            <b>forma.</b>
            <span>Objects for everyday living</span>
            <ShoppingBag size={11} />
          </div>
          <div className="store-body">
            <small>LESS, BUT BETTER.</small>
            <h3>
              Everyday.
              <br />
              Extraordinary.
            </h3>
            <div className="lamp">
              <i />
              <span />
            </div>
            <span className="mock-pill">
              Explore the collection <ArrowRight size={10} />
            </span>
          </div>
          <div className="mock-bottom">
            <span>Considered design.</span>
            <span>Made for your space.</span>
          </div>
        </div>
      ) : kind === "workspace" ? (
        <div className="workspace-mock">
          <aside>
            <b>◈ orbit</b>
            <span>Overview</span>
            <span>Projects</span>
            <span>Team</span>
            <span>Settings</span>
          </aside>
          <div>
            <div className="mock-top">
              <b>Good morning, Alex.</b>
              <span>⌘ K</span>
            </div>
            <small>Here’s what’s happening today.</small>
            <div className="mock-stats">
              <span>
                Active projects<b>12</b>
              </span>
              <span>
                Tasks complete<b>86</b>
              </span>
            </div>
            <div className="mock-chart">
              {[35, 55, 45, 70, 65, 85, 75, 95, 80, 100].map((n, i) => (
                <i style={{ height: `${n}%` }} key={i} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="learning-mock">
          <div className="mock-top">
            <b>
              learnpath<span>✳</span>
            </b>
            <span>Your learning, your pace.</span>
          </div>
          <h3>
            A little progress.
            <br />
            Every single day.
          </h3>
          <div className="learning-cards">
            <span>
              01
              <br />
              <b>
                Design
                <br />
                foundations
              </b>
            </span>
            <span>
              02
              <br />
              <b>
                Think
                <br />
                in systems
              </b>
            </span>
            <span>
              03
              <br />
              <b>
                Build
                <br />
                with purpose
              </b>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
export function ArticleArt({
  kind,
  alt = "Article cover",
}: {
  kind: string
  alt?: string
}) {
  const covers: Record<string, string> = {
    strategy: "/insights/website-strategy.png",
    design: "/insights/accessible-design.png",
    engineering: "/insights/software-engineering.png",
  }
  const source = kind.startsWith("/media/") ? kind : covers[kind]
  return source ? (
    <img
      src={source}
      className="article-art"
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <div className={`article-art ${kind}`} aria-hidden="true">
      {kind === "strategy" ? (
        <>
          <span className="art-word">
            What
            <br />
            comes
            <br />
            <i>next?</i>
          </span>
          <ArrowUpRight />
        </>
      ) : kind === "design" ? (
        <>
          <div className="design-circles">
            <i />
            <i />
            <i />
          </div>
          <span>Design for everyone.</span>
        </>
      ) : (
        <>
          <div className="art-code">
            {"{"}
            <span>
              build
              <br />
              <i>with purpose</i>
            </span>
            {"}"}
          </div>
        </>
      )}
    </div>
  )
}
export function Assurance({ children }: { children: ReactNode }) {
  return (
    <span className="assurance">
      <ShieldCheck size={15} />
      {children}
    </span>
  )
}
