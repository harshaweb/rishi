import { ManagedSection, useSectionCopy } from "../components/managed-section"
import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Search,
  Code2,
  Layers3,
  ShieldCheck,
  HeartHandshake,
  Copy,
  CheckCircle2,
  MapPin,
  Clock3,
  MoveRight,
} from "lucide-react"
import { useContent } from "../lib/content"
import { ContactChannels, SocialLinks } from "../components/engagement"
import {
  ArticleArt,
  Breadcrumbs,
  ButtonLink,
  CTA,
  Eyebrow,
  FaqList,
  PageHero,
  ProjectArt,
  SectionHeading,
  serviceIcons,
} from "../components/ui"
import { ApplicationForm, LeadForm } from "../components/forms"
import { Newsletter } from "../components/newsletter"
import { resetConsent } from "../lib/analytics"
import { api } from "../lib/api"

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              rel="noopener noreferrer"
              target={href?.startsWith("http") ? "_blank" : undefined}
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" && src.startsWith("/media/") ? (
              <img src={src} alt={alt || ""} loading="lazy" />
            ) : null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
export function Services() {
  const { content } = useContent()
  const [category, setCategory] = useState("All services")
  const categories = [
    "All services",
    ...new Set(content.services.map((s) => s.category)),
  ]
  const visibleServices = content.services.filter(
    (service) => category === "All services" || service.category === category
  )
  return (
    <>
      <PageHero
        className="services-intro"
        eyebrow="Services"
        title="Considered solutions. Connected thinking."
        description="From the first idea to your next stage of growth, find the right expertise for the work ahead."
      >
        <div className="services-intro-actions">
          <a className="button" href="#explore-services">
            Explore services <ArrowRight size={16} />
          </a>
          <Link className="services-intro-talk" to="/request-a-quote">
            Discuss your project <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="services-intro-visual">
          <div className="services-visual-label">
            <span /> ONE CONNECTED APPROACH
          </div>
          <div className="services-visual-core">
            <Layers3 size={25} />
            <span>
              Built around
              <br />
              <strong>your business.</strong>
            </span>
          </div>
          <div className="services-capabilities">
            {[
              {
                icon: Layers3,
                title: "Design & experience",
                detail: "Clear, considered, human.",
              },
              {
                icon: Code2,
                title: "Development & systems",
                detail: "Thoughtful foundations for what’s next.",
              },
              {
                icon: MoveRight,
                title: "Strategy & growth",
                detail: "A practical direction for your ambitions.",
              },
            ].map(({ icon: Icon, title, detail }, i) => (
              <div key={title}>
                <span className="capability-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <span>{detail}</span>
                </div>
                <span className="capability-number">0{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="services-visual-foot">
            <span>{content.services.length} services</span>
            <span>
              IDEA <ArrowRight size={11} /> LAUNCH <ArrowRight size={11} />{" "}
              BEYOND
            </span>
          </div>
        </div>
      </PageHero>
      <ManagedSection id="page:Services:1">
        <section
          className="section service-catalog container"
          id="explore-services"
        >
          <div className="catalog-heading">
            <div>
              <Eyebrow>THE EXPERTISE YOU NEED</Eyebrow>
              <h2>Find your next building block.</h2>
            </div>
            <p>
              Explore the services that bring your ideas, systems and ambitions
              together.
            </p>
          </div>
          <div className="filter-tabs" aria-label="Service category">
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? "selected" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
                <span className="filter-count">
                  {c === "All services"
                    ? content.services.length
                    : content.services.filter((s) => s.category === c).length}
                </span>
              </button>
            ))}
          </div>
          <div className="catalog-results" aria-live="polite">
            <span>{category}</span>
            <span>
              {visibleServices.length}{" "}
              {visibleServices.length === 1 ? "service" : "services"} to explore
            </span>
          </div>
          <div className="service-grid">
            {visibleServices.map((s) => {
              const Icon =
                serviceIcons[content.services.indexOf(s) % serviceIcons.length]
              return (
                <Link
                  key={s.id}
                  to={`/services/${s.slug}`}
                  className="service-card"
                  data-category={s.category}
                >
                  <div className="catalog-card-top">
                    <span className="service-icon">
                      <Icon size={24} />
                    </span>
                    <span className="catalog-category">{s.category}</span>
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                  <div className="service-card-bottom">
                    <span>Explore service</span>
                    <ArrowUpRight size={20} />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function ServiceDetail() {
  const { slug } = useParams()
  const { content } = useContent()
  const service = content.services.find((s) => s.slug === slug)
  if (!service) return <NotFound />
  const specificFaqs = content.faqs.filter((f) => f.serviceId === service.id)
  const faqs = specificFaqs.length
    ? specificFaqs
    : [
        {
          id: "scope",
          question: `What does your ${service.title.toLowerCase()} service include?`,
          answer: `${service.description} The final scope is agreed after discovery and can include ${service.benefits.map((b) => b.toLowerCase()).join(", ")}.`,
        },
        {
          id: "timeline",
          question: "How are timelines and costs agreed?",
          answer: `We assess the complexity of your ${service.category.toLowerCase()} requirements, integrations and content readiness, then prepare a scoped proposal. Dependencies and acceptance criteria are agreed before implementation.`,
        },
        {
          id: "handover",
          question: "Can you help after delivery?",
          answer:
            "Handover documentation and any ongoing support arrangement are agreed as part of the proposal. Ask about a maintenance plan that fits your operational requirements.",
        },
      ]
  return (
    <>
      <ManagedSection id="page:ServiceDetail:1">
        <section className="page-hero service-detail-hero">
          <div className="container">
            <Breadcrumbs
              items={[
                { title: "Services", to: "/services" },
                { title: service.title },
              ]}
            />
            <Eyebrow>{service.title}</Eyebrow>
            <h1>{service.headline}</h1>
            <p>{service.description}</p>
            <ButtonLink
              to={`/request-a-quote?service=${encodeURIComponent(service.title)}`}
            >
              Discuss your project
            </ButtonLink>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="page:ServiceDetail:2">
        <section className="section detail-grid container">
          <div>
            <Eyebrow>BUILT AROUND YOUR BUSINESS</Eyebrow>
            <h2>
              A clear purpose.
              <br />A practical solution.
            </h2>
            <SafeMarkdown>{service.body}</SafeMarkdown>
            <h3>What you can expect</h3>
            <ul className="benefit-list">
              {service.benefits.map((b) => (
                <li key={b}>
                  <Check size={17} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <aside className="detail-aside">
            <Code2 size={30} />
            <h3>Let’s define what’s next.</h3>
            <p>
              Share your goals, constraints and existing setup. We’ll help you
              find a practical way forward.
            </p>
            <ButtonLink
              to={`/request-a-quote?service=${encodeURIComponent(service.title)}`}
            >
              Request a proposal
            </ButtonLink>
            <Link to="/process">
              How we work <ArrowRight size={15} />
            </Link>
          </aside>
        </section>
      </ManagedSection>
      <ManagedSection id="page:ServiceDetail:3">
        <section className="section subtle-section">
          <div className="container">
            <SectionHeading
              eyebrow="OUR APPROACH"
              title="From understanding to delivery."
            />
            <div className="process-grid three">
              {service.process.map((step, i) => (
                <div className="process-step" key={step}>
                  <div className="process-top">
                    <span>0{i + 1}</span>
                    <div />
                    <ArrowRight size={16} />
                  </div>
                  <h3>{step}</h3>
                  <p>
                    {
                      [
                        "Define the requirements, constraints and acceptance criteria together.",
                        "Review progress in practical stages and evaluate decisions with your team.",
                        "Validate the agreed scope, prepare documentation and plan the next step.",
                      ][i % 3]
                    }
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="page:ServiceDetail:4">
        <section className="section faq-grid container">
          <div>
            <Eyebrow>YOUR QUESTIONS, ANSWERED</Eyebrow>
            <h2>
              More clarity
              <br />
              before you start.
            </h2>
          </div>
          <FaqList items={faqs} />
        </section>
      </ManagedSection>
      <ManagedSection id="page:ServiceDetail:5">
        <section className="section container">
          <SectionHeading
            eyebrow="CONNECTED EXPERTISE"
            title="A stronger solution, together."
          />
          <div className="related-links">
            {content.services
              .filter(
                (s) =>
                  s.id !== service.id &&
                  (s.category === service.category || s.slug === "maintenance")
              )
              .slice(0, 4)
              .map((s) => (
                <Link key={s.id} to={`/services/${s.slug}`}>
                  {s.title}
                  <ArrowUpRight size={17} />
                </Link>
              ))}
          </div>
          <Link className="text-link" to="/industries">
            Explore industry experience <ArrowRight size={17} />
          </Link>
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function Industries() {
  const { content } = useContent()
  return (
    <>
      <PageHero
        eyebrow="Industries"
        title="Built for the way your world works."
        description="Different industries ask different questions. We start by understanding yours."
      />
      <ManagedSection id="page:Industries:1">
        <section className="section container">
          <div className="industry-card-grid">
            {content.industries.map((ind, i) => (
              <Link key={ind.id} to={`/industries/${ind.slug}`}>
                <span className="eyebrow">0{i + 1} / INDUSTRY</span>
                <h2>{ind.title}</h2>
                <p>{ind.description}</p>
                <span className="text-link">
                  Explore the possibilities <ArrowUpRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function IndustryDetail() {
  const { slug } = useParams()
  const { content } = useContent()
  const ind = content.industries.find((i) => i.slug === slug)
  if (!ind) return <NotFound />
  return (
    <>
      <PageHero
        eyebrow={ind.title}
        title={ind.description}
        description={`Digital experiences and connected systems shaped around the practical needs of ${ind.title.toLowerCase()} businesses.`}
      />
      <ManagedSection id="page:IndustryDetail:1">
        <section className="section detail-grid container">
          <div>
            <Eyebrow>YOUR CONTEXT MATTERS</Eyebrow>
            <h2>
              Understanding first.
              <br />
              Technology second.
            </h2>
            <SafeMarkdown>{ind.body}</SafeMarkdown>
            <h3>Where we can help</h3>
            <ul className="benefit-list">
              {ind.benefits.map((b) => (
                <li key={b}>
                  <Check size={17} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <aside className="detail-aside">
            <Layers3 size={28} />
            <h3>Built around your priorities.</h3>
            <p>Tell us about your organisation, existing tools and goals.</p>
            <ButtonLink to="/request-a-quote">Start a conversation</ButtonLink>
          </aside>
        </section>
      </ManagedSection>
      <ManagedSection id="page:IndustryDetail:2">
        <section className="section subtle-section">
          <div className="container">
            <SectionHeading
              eyebrow="CONNECTED SERVICES"
              title="The expertise behind your next move."
            />
            <div className="related-links">
              {content.services
                .filter((s) =>
                  [
                    "website-development",
                    "web-applications",
                    "api-integration",
                    "it-consulting",
                  ].includes(s.slug)
                )
                .map((s) => (
                  <Link key={s.id} to={`/services/${s.slug}`}>
                    {s.title}
                    <ArrowUpRight size={18} />
                  </Link>
                ))}
            </div>
          </div>
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function Portfolio() {
  const { content } = useContent()
  const [filter, setFilter] = useState("All projects")
  return (
    <>
      <PageHero
        eyebrow="Our work"
        title="Ideas you can see. Possibilities you can build."
        description="Explore original demonstration projects. These concepts illustrate our thinking and are not presented as commissioned client work."
      />
      <ManagedSection id="page:Portfolio:1">
        <section className="section container">
          <div className="filter-tabs">
            {[
              "All projects",
              ...new Set(content.projects.map((p) => p.industry)),
            ].map((c) => (
              <button
                key={c}
                className={filter === c ? "selected" : ""}
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="featured-projects">
            {content.projects
              .filter((p) => filter === "All projects" || p.industry === filter)
              .map((p) => (
                <Link
                  className="project-card"
                  key={p.id}
                  to={`/portfolio/${p.slug}`}
                >
                  <div className="project-image-wrap">
                    <ProjectArt kind={p.cover} />
                    {p.demo && (
                      <span className="demo-label">DEMONSTRATION CONCEPT</span>
                    )}
                    <span className="project-arrow">
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
                  <div className="project-info">
                    <div>
                      <span className="eyebrow">{p.industry}</span>
                      <h3>{p.title}</h3>
                      <p>{p.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
          </div>
          {!content.projects.length && <p>No projects are published yet.</p>}
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function ProjectDetail() {
  const { slug } = useParams()
  const { content } = useContent()
  const project = content.projects.find((p) => p.slug === slug)
  if (!project) return <NotFound />
  return (
    <>
      <PageHero
        eyebrow="Project study"
        title={project.title}
        description={project.description}
      >
        {project.demo && (
          <span className="badge">
            Demonstration concept · Not commissioned client work
          </span>
        )}
      </PageHero>
      <ManagedSection id="page:ProjectDetail:1">
        <section className="section container">
          <ProjectArt kind={project.cover} large />
          <div className="project-detail-grid">
            <div>
              <Eyebrow>THE THINKING BEHIND THE EXPERIENCE</Eyebrow>
              <h2>Purpose, made visible.</h2>
              <SafeMarkdown>{project.body}</SafeMarkdown>
              {project.results && (
                <>
                  <h3>Documented results</h3>
                  <p>{project.results}</p>
                </>
              )}
              {project.url && (
                <a
                  className="button"
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit project
                  <ArrowUpRight size={16} />
                </a>
              )}
            </div>
            <aside>
              <h3>Project overview</h3>
              <p className="eyebrow">INDUSTRY</p>
              <p>{project.industry}</p>
              <p className="eyebrow">SERVICES</p>
              <p>{project.services.join(" · ")}</p>
              <p className="eyebrow">TECHNOLOGIES</p>
              <div className="tags">
                {project.technologies.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </aside>
          </div>
          {project.gallery.length > 0 && (
            <div className="featured-projects">
              {project.gallery.map((image) => (
                <img
                  className="project-image"
                  key={image}
                  src={image}
                  alt={`${project.title} project gallery`}
                  loading="lazy"
                />
              ))}
            </div>
          )}
          <Link className="text-link" to="/portfolio">
            Explore all projects
            <ArrowRight size={17} />
          </Link>
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function Resources() {
  const { content } = useContent()
  const [params, setParams] = useSearchParams()
  const search = params.get("q") || ""
  const category = params.get("category") || ""
  const tag = params.get("tag") || ""
  const page = Math.max(1, Number(params.get("page")) || 1)
  const filtered = content.posts
    .filter(
      (p) =>
        (!category || p.categoryId === category) &&
        (!tag ||
          ((p as typeof p & { tags?: { id: string }[] }).tags || []).some(
            (t) => t.id === tag
          )) &&
        `${p.title} ${p.description} ${p.body}`
          .toLowerCase()
          .includes(search.toLowerCase())
    )
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete("page")
    setParams(next, { replace: true })
  }
  return (
    <>
      <PageHero
        eyebrow="Insights & resources"
        title="Perspective for your next move."
        description="Practical thinking on design, engineering and digital growth. Our starting collection contains clearly labelled, editable editorial samples."
      />
      <ManagedSection id="page:Resources:1">
        <section className="section container">
          <div className="resource-toolbar">
            <div className="search-field">
              <Search size={18} />
              <label className="sr-only" htmlFor="resource-search">
                Search articles
              </label>
              <input
                id="resource-search"
                placeholder="Search ideas, topics and perspectives…"
                value={search}
                onChange={(e) => update("q", e.target.value)}
              />
            </div>
            <label className="sr-only" htmlFor="resource-category">
              Article category
            </label>
            <select
              id="resource-category"
              value={category}
              onChange={(e) => update("category", e.target.value)}
            >
              <option value="">All categories</option>
              {content.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="resource-tag">
              Article tag
            </label>
            <select
              id="resource-tag"
              value={tag}
              onChange={(e) => update("tag", e.target.value)}
            >
              <option value="">All tags</option>
              {content.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <p className="result-count" aria-live="polite">
            {filtered.length} perspective{filtered.length !== 1 && "s"} to
            explore
          </p>
          <div className="article-grid">
            {filtered.slice((page - 1) * 6, page * 6).map((p) => (
              <Link
                className="article-card"
                key={p.id}
                to={`/resources/${p.slug}`}
              >
                <ArticleArt
                  kind={p.cover}
                  alt={`${p.title} — editorial illustration`}
                />
                <div className="article-meta">
                  <span>
                    {content.categories.find((c) => c.id === p.categoryId)
                      ?.title || "Insights"}
                  </span>
                  <span>
                    {p.featured && "FEATURED · "}
                    {/^post-\d+$/.test(p.id)
                      ? "EDITORIAL SAMPLE"
                      : "HARSHAWEB EDITORIAL"}
                  </span>
                </div>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <span className="text-link">
                  Read the perspective
                  <ArrowUpRight size={16} />
                </span>
              </Link>
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={30} />
              <h2>No matching perspectives.</h2>
              <p>Try another topic or clear your filters.</p>
              <button
                className="button button-secondary"
                onClick={() => setParams({})}
              >
                Clear filters
              </button>
            </div>
          )}
          {filtered.length > 6 && (
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => {
                  params.set("page", String(page - 1))
                  setParams(params)
                }}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(filtered.length / 6)}
              </span>
              <button
                disabled={page * 6 >= filtered.length}
                onClick={() => {
                  params.set("page", String(page + 1))
                  setParams(params)
                }}
              >
                Next
              </button>
            </div>
          )}
        </section>
      </ManagedSection>
      <ManagedSection id="page:Resources:2">
        <section className="newsletter-section">
          <div className="container">
            <div>
              <Eyebrow>GOOD IDEAS, OCCASIONALLY.</Eyebrow>
              <h2>A little perspective in your inbox.</h2>
              <p>
                Join the list for thoughtful notes on building better digital
                experiences.
              </p>
            </div>
            <Newsletter />
          </div>
        </section>
      </ManagedSection>
    </>
  )
}
export function ArticleDetail() {
  const { slug } = useParams()
  const { content } = useContent()
  const post = content.posts.find((p) => p.slug === slug)
  const [copied, setCopied] = useState("")
  if (!post) return <NotFound />
  return (
    <>
      <PageHero
        eyebrow={
          content.categories.find((c) => c.id === post.categoryId)?.title ||
          "Insights"
        }
        title={post.title}
        description={post.description}
      >
        <div className="article-byline">
          <span>
            Harshaweb editorial
            {/^post-\d+$/.test(post.id) && " · Editable sample"}
          </span>
          <span>
            {Math.max(1, Math.ceil(post.body.split(/\s+/).length / 200))} min
            read
          </span>
        </div>
      </PageHero>
      <article className="section article-detail container">
        <ArticleArt
          kind={post.cover}
          alt={`${post.title} — editorial illustration`}
        />
        <SafeMarkdown>{post.body}</SafeMarkdown>
        <div className="article-share">
          <Link className="text-link" to="/resources">
            More perspectives
            <ArrowRight size={17} />
          </Link>
          <button
            className="button button-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href)
                setCopied("Link copied")
              } catch {
                setCopied("Could not copy. Copy the address from your browser.")
              }
            }}
          >
            {copied === "Link copied" ? (
              <CheckCircle2 size={15} />
            ) : (
              <Copy size={15} />
            )}
            Copy article link
          </button>
        </div>
        {copied && <p role="status">{copied}</p>}
        <h2>Keep exploring</h2>
        <div className="related-links">
          {content.posts
            .filter((p) => p.id !== post.id)
            .slice(0, 2)
            .map((p) => (
              <Link to={`/resources/${p.slug}`} key={p.id}>
                {p.title}
                <ArrowUpRight size={16} />
              </Link>
            ))}
        </div>
      </article>
      <CTA />
    </>
  )
}
export function About() {
  return (
    <>
      <PageHero
        eyebrow="About Harshaweb"
        title="We believe good technology should move you forward."
        description="Harshaweb brings together web development, applications, IT services, digital marketing and technology consulting with a simple focus: building useful digital experiences."
      />
      <ManagedSection id="page:About:1">
        <section className="section about-grid container">
          <div>
            <Eyebrow>THOUGHTFUL BY DESIGN</Eyebrow>
            <h2>
              Big-picture thinking.
              <br />
              Care in the details.
            </h2>
          </div>
          <div className="prose">
            <p>
              A digital project should begin with your business, your people and
              your goals. We ask questions, make room for different perspectives
              and turn what we learn into practical decisions.
            </p>
            <p>
              Our approach connects design and engineering from the start. We
              work in reviewable stages, explain trade-offs clearly and plan for
              the realities of running and maintaining a digital product.
            </p>
            <p>
              From a focused business website to an integrated application, the
              goal stays the same: useful experiences, dependable foundations
              and a clear path to what comes next.
            </p>
            <ButtonLink to="/process">See how we work</ButtonLink>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="page:About:2">
        <section className="section subtle-section">
          <div className="container">
            <SectionHeading
              eyebrow="HOW WE SHOW UP"
              title="Principles that guide the work."
            />
            <div className="values-grid">
              {[
                [
                  HeartHandshake,
                  "Partnership",
                  "Shared context, honest conversations and clear responsibilities.",
                ],
                [
                  Layers3,
                  "Purposeful design",
                  "Experiences shaped around real tasks and the people completing them.",
                ],
                [
                  ShieldCheck,
                  "Dependable foundations",
                  "Maintainability, accessibility and security considered throughout the work.",
                ],
              ].map(([Icon, title, desc]) => {
                const I = Icon as typeof Code2
                return (
                  <div key={String(title)}>
                    <I size={26} />
                    <h3>{String(title)}</h3>
                    <p>{String(desc)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="page:About:3">
        <section className="section container">
          <SectionHeading
            eyebrow="MEET THE THINKING BEHIND THE WORK"
            title="A collaborative way forward."
          />
          <div className="related-links">
            <Link to="/team">
              Our team
              <ArrowUpRight size={18} />
            </Link>
            <Link to="/careers">
              Build your next chapter
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function Team() {
  const { content } = useContent()
  return (
    <>
      <PageHero
        eyebrow="Our team"
        title="People behind the possibilities."
        description="Good digital work brings together product thinking, design, engineering and delivery. We’re building a place for that work to happen."
      />
      <ManagedSection id="page:Team:1">
        <section className="section container">
          {content.team.length ? (
            <div className="team-grid">
              {content.team.map((member) => (
                <div className="team-card" key={member.id}>
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} loading="lazy" />
                  ) : (
                    <div className="team-avatar" aria-hidden="true">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                  )}
                  <h2>{member.name}</h2>
                  <p className="eyebrow">{member.role}</p>
                  <p>{member.bio}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <HeartHandshake size={38} />
              <h2>Meet the team through a conversation.</h2>
              <p>
                Individual team profiles haven’t been published yet. Tell us
                about your project and we’ll introduce the right people as part
                of discovery.
              </p>
              <ButtonLink to="/contact">Get in touch</ButtonLink>
            </div>
          )}
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function Process() {
  const steps = [
    [
      "Discover the right problem",
      "We align on your goals, audience, constraints and existing systems. A discovery brief captures the scope, assumptions and priorities.",
      [
        "Stakeholder conversations",
        "Requirements and integration mapping",
        "Scope and acceptance criteria",
      ],
    ],
    [
      "Design the right experience",
      "We map the important journeys and build prototypes to evaluate structure, content and interactions before committing to implementation.",
      [
        "Information architecture",
        "Wireframes and interactive prototypes",
        "Accessible visual system",
      ],
    ],
    [
      "Build in reviewable stages",
      "We develop the agreed scope with regular checkpoints. Design and engineering stay connected, and decisions are documented as the product takes shape.",
      [
        "Iterative implementation",
        "Integration and security checks",
        "Progress reviews and feedback",
      ],
    ],
    [
      "Validate, launch and evolve",
      "We test critical flows, prepare the release and document the handover. Any ongoing maintenance and improvement plan is agreed explicitly.",
      [
        "Functional and responsive testing",
        "Release and handover documentation",
        "Maintenance and iteration planning",
      ],
    ],
  ]
  return (
    <>
      <PageHero
        eyebrow="Our process"
        title="Less guesswork. More shared clarity."
        description="A practical, collaborative process that connects your first idea to a considered delivery."
      />
      <ManagedSection id="page:Process:1">
        <section className="section process-details container">
          {steps.map(([title, description, bullets], i) => (
            <div className="process-detail" key={String(title)}>
              <span className="process-big-number">0{i + 1}</span>
              <div>
                <Eyebrow>PHASE 0{i + 1}</Eyebrow>
                <h2>{String(title)}</h2>
                <p>{String(description)}</p>
              </div>
              <ul className="benefit-list">
                {(bullets as string[]).map((b) => (
                  <li key={b}>
                    <Check size={16} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function Technology() {
  const groups = [
    [
      "Frontend experiences",
      ["React", "Next.js", "TypeScript", "Tailwind CSS"],
      "Accessible, responsive interfaces with a component foundation that supports future change.",
    ],
    [
      "Application foundations",
      ["Node.js", "REST APIs", "PostgreSQL", "Prisma"],
      "Structured data, documented integrations and permissioned workflows built around your requirements.",
    ],
    [
      "Delivery & quality",
      ["Git", "Docker", "Vitest", "Playwright"],
      "Reviewable changes, reproducible environments and checks focused on important user journeys.",
    ],
    [
      "Cloud & integrations",
      [
        "AWS",
        "S3-compatible storage",
        "Transactional email",
        "Payment providers",
      ],
      "Managed services selected for your operational, budget and security needs.",
    ],
  ]
  return (
    <>
      <PageHero
        eyebrow="Technology stack"
        title="Tools chosen with intention."
        description="A stack should serve your product. We evaluate requirements, existing systems and long-term ownership before choosing the right foundation."
      />
      <ManagedSection id="page:Technology:1">
        <section className="section container">
          <div className="technology-grid">
            {groups.map(([title, tools, description]) => (
              <div key={String(title)}>
                <Code2 size={26} />
                <h2>{String(title)}</h2>
                <p>{String(description)}</p>
                <div className="tags">
                  {(tools as string[]).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="notice-panel">
            <ShieldCheck size={25} />
            <div>
              <h3>Technology choices are project-specific.</h3>
              <p>
                These are examples of tools that may be used. This list does not
                imply a partnership, certification or endorsement by their
                providers.
              </p>
            </div>
          </div>
        </section>
      </ManagedSection>
      <CTA />
    </>
  )
}
export function Careers() {
  const { content } = useContent()
  return (
    <>
      <PageHero
        eyebrow="Careers"
        title="Build what comes next. Including your career."
        description="Curious minds, thoughtful makers and people who care about the work. Tell us what you’d bring to Harshaweb."
      />
      <ManagedSection id="page:Careers:1">
        <section className="section careers-grid container">
          <div>
            <Eyebrow>ROOM FOR GOOD THINKING</Eyebrow>
            <h2>Bring your perspective.</h2>
            <p>
              We value clarity, care and a willingness to learn. Explore
              published roles or send a general expression of interest.
            </p>
            <h3>Open opportunities</h3>
            {content.jobs.length ? (
              content.jobs.map((job) => (
                <article className="job-card" key={job.id}>
                  <h3>{job.title}</h3>
                  <div>
                    <span>
                      <MapPin size={14} />
                      {job.location}
                    </span>
                    <span>
                      <Clock3 size={14} />
                      {job.type}
                    </span>
                  </div>
                  <p>{job.description}</p>
                  <details>
                    <summary>Role details</summary>
                    <SafeMarkdown>{job.body}</SafeMarkdown>
                  </details>
                </article>
              ))
            ) : (
              <div className="notice-panel">
                <div>
                  <h3>No roles are currently published.</h3>
                  <p>
                    You can still send an expression of interest. This does not
                    indicate a current vacancy or guarantee a response.
                  </p>
                </div>
              </div>
            )}
          </div>
          <ApplicationForm />
        </section>
      </ManagedSection>
    </>
  )
}
export function Contact({
  quote = false,
  kind,
}: {
  quote?: boolean
  kind?: "website" | "application" | "marketing"
}) {
  const [params] = useSearchParams()
  const formKind = kind || (quote ? "quote" : "contact")
  return (
    <>
      <PageHero
        eyebrow={quote ? "Request a quote" : "Contact us"}
        title={
          quote
            ? "Every great project starts somewhere."
            : "Let’s turn a good conversation into a great next step."
        }
        description={
          quote
            ? "Share your idea, priorities and a little context. We’ll review your brief and help define a practical way forward."
            : "A question, a challenge, a new idea. We’d love to hear what you’re working on."
        }
      />
      <ManagedSection id="page:Contact:1">
        <section className="section contact-grid project-enquiry container">
          <div className="project-enquiry-aside">
            <Eyebrow>LET’S CONNECT THE DOTS</Eyebrow>
            <h2>
              Your next chapter
              <br />
              starts here.
            </h2>
            <p>
              Tell us what you want to achieve. The more context you share, the
              more useful our first conversation can be.
            </p>
            <div className="contact-steps">
              {[
                "Share your goals and requirements.",
                "We review your brief and existing setup.",
                "We discuss scope and the right next step.",
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  <p>{s}</p>
                </div>
              ))}
            </div>
            <ContactChannels />
            <SocialLinks />
            <div className="contact-privacy">
              <ShieldCheck size={21} />
              <p>
                Your information is used to respond to your enquiry. Read our{" "}
                <Link to="/privacy-policy">Privacy Policy</Link> for details.
              </p>
            </div>
          </div>
          <LeadForm
            key={`${formKind}:${params.get("service") || ""}`}
            kind={formKind}
          />
        </section>
      </ManagedSection>
    </>
  )
}
export function Legal({ policy }: { policy: "privacy" | "terms" | "cookies" }) {
  const copy = useSectionCopy(`legal:${policy}`)
  const { content } = useContent()
  const [resetMessage, setResetMessage] = useState("")
  const title =
    policy === "privacy"
      ? "Privacy Policy"
      : policy === "terms"
        ? "Terms & Conditions"
        : "Cookie Policy"
  const text =
    policy === "privacy"
      ? `## Information you provide\nWhen you submit an enquiry, we collect your name, email, phone, company, chosen service, budget, timeline, project description and any optional website URL. Career applications include your contact details, message, optional portfolio and résumé. Newsletter subscriptions record an email address and consent timestamp.\n\n## How information is used\nWe use enquiries to discuss potential work and follow up on your request. Applications are used to consider professional opportunities. Newsletter details are used for communications you have requested. Staff may record follow-up notes. We do not sell submitted contact information.\n\n## Storage and service providers\nRecords are stored in PostgreSQL. Uploaded files use local storage in development and configured private object storage in production. If configured, a transactional email provider receives the recipient address and enquiry reference to send confirmations and notifications. Authorised staff can access records through the protected admin area.\n\n## Your choices\nSubmitting an enquiry or application is optional. Newsletter consent is separate from project contact consent. Future newsletters must include an unsubscribe link. You can request access, correction or deletion of submitted information through the contact form. We may need to verify your identity before fulfilling a request.\n\n## Retention and security\nInformation is retained only while needed for its purpose or an applicable legal obligation. The operator must set and document a production retention schedule before launch. The application includes staff access controls, session protection, input validation and administrative audit records. No system can guarantee absolute security.\n\n## Contact\nUse the website contact form${content.settings.contactEmail ? ` or email ${content.settings.contactEmail}` : ""} for privacy questions. The production operator must publish its legal entity, applicable jurisdiction, retention periods and privacy contact before accepting live personal information.`
      : policy === "terms"
        ? `## Using this website\nThis website describes Harshaweb’s web development, application development, IT, marketing and consulting services. Information is provided to help you understand possible services and start a conversation. A submitted enquiry does not create a project agreement or commit either party to provide or purchase services.\n\n## Project agreements\nScope, deliverables, timelines, pricing, payments, ownership, licensing, confidentiality, support and acceptance criteria are governed by a separate written agreement. Do not rely on website copy as a quotation or service guarantee.\n\n## Demonstration content\nProjects labelled as demonstrations are original illustrative concepts. They are not presented as commissioned client work, proven business outcomes or live commercial services. Editorial samples are provided for review and customisation.\n\n## Intellectual property\nWebsite branding, original copy and original graphics may not be misrepresented as another organisation’s work. Third-party software and trademarks remain subject to their owners’ rights and applicable licences.\n\n## Acceptable use\nDo not attempt unauthorised access, upload harmful content, abuse forms or interfere with availability. Use enquiry and application forms only for relevant, lawful communications.\n\n## Third-party services\nWhere a project requires a third-party platform, its availability, charges and terms are separate from this website. Service suitability and responsibilities should be agreed during project discovery.\n\n## Before production launch\nThe business operator must review these draft terms and add its legal entity, jurisdiction, dispute process and appropriate liability provisions. These terms do not override rights that cannot lawfully be excluded.`
        : `## Essential cookies\nThe staff login area uses an HTTP-only session cookie named harshaweb.sid. It is used to maintain a signed-in staff session and security token, with a maximum session duration of eight hours. In production the cookie is restricted to HTTPS and uses a strict same-site policy. The cookie is removed on logout.\n\n## Local preferences\nYour browser stores a harshaweb-consent preference in local storage so the website can remember your cookie choice. It is a preference record rather than a tracking cookie.\n\n## Optional analytics\nOptional tracking is disabled by default. Choosing “Allow optional” records your preference, and loads a Google Analytics or Tag Manager integration only when the operator has configured its identifier. No optional scripts load before consent. Analytics page views exclude URL query strings, and enquiry conversion events do not contain your submitted form fields. The operator must review tags, recipients and data use before enabling an integration.\n\n## Changing your choice\nUse the control below to remove your saved preference and choose again. You can also manage cookies and site storage in your browser settings.`
  return (
    <>
      <PageHero
        eyebrow="Website policies"
        title={title}
        description="Clear information about this website, your choices and how submitted information is handled."
      />
      <article className="section legal-page container">
        <div className="notice-panel">
          <ShieldCheck size={24} />
          <p>
            Draft operational policy — review the legal entity, jurisdiction and
            retention details before production launch.
          </p>
        </div>
        <SafeMarkdown>{copy.body || text}</SafeMarkdown>
        {policy !== "terms" && (
          <div className="prose">
            <h2>Videos and external contact services</h2>
            <p>
              Our built-in process video is served by this website. YouTube and
              Vimeo players load only when you click to load an external video;
              that action connects your browser to the selected provider, which
              may process connection information and use its own storage. A text
              transcript is available when supplied. WhatsApp, booking
              calendars, social profiles and map directions open separate
              services only when you follow those links. Their own privacy terms
              apply. Consultation requests submitted here are stored as
              enquiries and do not confirm a meeting.
            </p>
          </div>
        )}
        {policy === "cookies" && (
          <>
            <button
              className="button button-secondary"
              onClick={() => {
                setResetMessage("Resetting your preference…")
                resetConsent()
              }}
            >
              Reset cookie preference
            </button>
            {resetMessage && <p role="status">{resetMessage}</p>}
          </>
        )}
      </article>
    </>
  )
}
export function Unsubscribe() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  return (
    <>
      <PageHero
        eyebrow="Newsletter preferences"
        title="A little less in your inbox."
        description="Confirm below to unsubscribe from the Harshaweb newsletter."
      />
      <ManagedSection id="page:Unsubscribe:1">
        <section className="section container">
          <button
            className="button"
            disabled={pending || Boolean(message) || !params.get("token")}
            onClick={async () => {
              setPending(true)
              setError("")
              try {
                const data = await api<{ message: string }>(
                  "/api/newsletter/unsubscribe",
                  {
                    method: "POST",
                    body: JSON.stringify({ token: params.get("token") }),
                  }
                )
                setMessage(data.message)
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Please try again."
                )
              } finally {
                setPending(false)
              }
            }}
          >
            {pending ? "Updating preference…" : "Confirm unsubscribe"}
          </button>
          {!params.get("token") && (
            <p>
              Open the unsubscribe link from your newsletter, or{" "}
              <Link to="/contact">contact us</Link> for help.
            </p>
          )}
          {message && <p role="status">{message}</p>}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </ManagedSection>
    </>
  )
}
export function NotFound() {
  return (
    <ManagedSection id="page:NotFound:1">
      <section className="not-found container">
        <span className="not-found-number">404</span>
        <Eyebrow>A LITTLE OFF THE MAP</Eyebrow>
        <h1>This page took a different path.</h1>
        <p>Let’s get you back to something useful.</p>
        <div className="hero-actions">
          <ButtonLink to="/">Back to home</ButtonLink>
          <Link className="text-link" to="/services">
            Explore our services
            <MoveRight size={17} />
          </Link>
        </div>
      </section>
    </ManagedSection>
  )
}
