import { ManagedSection } from "../components/managed-section"
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Code2,
  Layers,
  MousePointer2,
  Sparkles,
  ShieldCheck,
  Braces,
  Workflow,
  Circle,
  Plus,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useContent } from "../lib/content"
import {
  ArticleArt,
  Assurance,
  ButtonLink,
  Eyebrow,
  FaqList,
  ProjectArt,
  SectionHeading,
  serviceIcons,
} from "../components/ui"
import { DeferredEnquiry } from "../components/deferred-enquiry"
import { VideoSection } from "../components/engagement"

function HeroGraphic() {
  return (
    <div
      className="hero-graphic"
      aria-label="Original illustration of connected design, development and launch workflows"
      role="img"
    >
      <div className="graphic-grid" />
      <div className="orbital orbital-one" />
      <div className="orbital orbital-two" />
      <div className="graphic-cross cross-one">+</div>
      <div className="graphic-cross cross-two">+</div>
      <div className="orbit-label label-top">
        <span />
        IDEAS → IMPACT
      </div>
      <div className="glass-card design-chip">
        <span className="chip-icon">
          <Layers size={17} />
        </span>
        <div>
          <small>THOUGHTFULLY</small>
          <b>Designed.</b>
        </div>
        <span className="chip-check">
          <Check size={12} />
        </span>
      </div>
      <div className="code-window">
        <div className="window-chrome">
          <span />
          <span />
          <span />
          <b>build-something-great.tsx</b>
          <Braces size={12} />
        </div>
        <div className="code-lines">
          <div>
            <i>01</i>
            <span className="code-purple">const</span> nextChapter{" "}
            <span className="code-blue">=</span> {"{"}
          </div>
          <div>
            <i>02</i>
            <span className="code-indent">vision:</span>{" "}
            <span className="code-green">'Your ambition'</span>,
          </div>
          <div>
            <i>03</i>
            <span className="code-indent">design:</span>{" "}
            <span className="code-green">'With purpose'</span>,
          </div>
          <div>
            <i>04</i>
            <span className="code-indent">technology:</span>{" "}
            <span className="code-green">'Built to last'</span>,
          </div>
          <div>
            <i>05</i>
            <span className="code-indent">possibilities:</span>{" "}
            <span className="code-orange">Infinity</span>
          </div>
          <div>
            <i>06</i>
            {"}"};
          </div>
          <div>
            <i>07</i>
          </div>
          <div>
            <i>08</i>
            <span className="code-purple">await</span>{" "}
            <span className="code-blue">bringToLife</span>(nextChapter);
            <span className="cursor" />
          </div>
        </div>
        <div className="code-status">
          <span>
            <span />
            All systems, ready.
          </span>
          <span>Harshaweb / v.next</span>
        </div>
      </div>
      <div className="hero-sphere">
        <div className="sphere-latitude lat-1" />
        <div className="sphere-latitude lat-2" />
        <div className="sphere-latitude lat-3" />
        <div className="sphere-longitude long-1" />
        <div className="sphere-longitude long-2" />
        <Code2 size={55} strokeWidth={1.2} />
      </div>
      <div className="glass-card launch-chip">
        <span className="launch-dot">
          <ArrowUpRight size={20} />
        </span>
        <div>
          <b>Built for what’s next.</b>
          <small>From the first idea to the next milestone.</small>
        </div>
      </div>
      <div className="graphic-cursor">
        <MousePointer2 fill="#7d91ff" size={22} />
        <span>Your next big idea</span>
      </div>
      <div className="orbit-label label-bottom">
        DESIGN <Plus size={10} /> ENGINEERING <Plus size={10} /> GROWTH
      </div>
    </div>
  )
}
const process = [
  [
    "Discover",
    "We ask the right questions. Your goals, your audience, your next move.",
  ],
  [
    "Design",
    "We turn clarity into intuitive journeys and thoughtful visual experiences.",
  ],
  [
    "Develop",
    "We bring it to life with dependable engineering and regular reviews.",
  ],
  [
    "Deliver & evolve",
    "We launch with care, hand over clearly and help you plan what’s next.",
  ],
]
export function Home() {
  const { content } = useContent()
  return (
    <>
      <ManagedSection id="home:Home:1">
        <section className="home-hero">
          <div className="hero-inner container">
            <div className="hero-copy">
              <Eyebrow>{content.settings.heroEyebrow}</Eyebrow>
              <h1>
                {content.settings.heroTitle ===
                "Technology that moves your business forward." ? (
                  <>
                    Technology that
                    <br />
                    moves your
                    <br />
                    <span>business forward.</span>
                  </>
                ) : (
                  content.settings.heroTitle
                )}
              </h1>
              <p>{content.settings.heroDescription}</p>
              <div className="hero-actions">
                <ButtonLink to="/request-a-quote">
                  Discuss your project
                </ButtonLink>
                <Link className="hero-secondary" to="/services">
                  Explore our services
                  <ArrowRight size={17} />
                </Link>
              </div>
              <div className="hero-assurances">
                <Assurance>Built with purpose</Assurance>
                <span className="assurance-divider" />
                <Assurance>Ready for what’s next</Assurance>
              </div>
            </div>
            <HeroGraphic />
          </div>
          <div className="hero-bottom container">
            <span>ONE PARTNER. YOUR ENTIRE DIGITAL JOURNEY.</span>
            <a href="#expertise" className="scroll-hint">
              SCROLL TO EXPLORE <span>↓</span>
            </a>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:2">
        <section className="capabilities-strip">
          <div className="container">
            {[
              [Code2, "Engineering that lasts"],
              [Layers, "Design that connects"],
              [Workflow, "Systems that work together"],
              [Sparkles, "Growth with direction"],
            ].map(([Icon, title]) => {
              const I = Icon as typeof Code2
              return (
                <div key={String(title)}>
                  <I size={20} />
                  <span>{String(title)}</span>
                </div>
              )
            })}
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:3">
        <section className="section services-section" id="expertise">
          <div className="container">
            <SectionHeading
              eyebrow="OUR EXPERTISE"
              title="Your ambition. Our expertise."
              description="From your first digital touchpoint to your next big platform. Everything you need to move forward, thoughtfully connected."
              to="/services"
              label="Explore all services"
            />
            <div className="service-grid">
              {[0, 1, 7, 8, 9, 14].map((index, i) => {
                const s = content.services[index]
                if (!s) return null
                const Icon = serviceIcons[index]
                return (
                  <Link
                    to={`/services/${s.slug}`}
                    className="service-card"
                    key={s.id}
                  >
                    <div className="service-card-top">
                      <span className={`service-icon icon-${i}`}>
                        <Icon size={23} strokeWidth={1.5} />
                      </span>
                      <span className="service-number">0{i + 1}</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                    <div className="service-card-bottom">
                      <span>{s.category.toUpperCase()}</span>
                      <ArrowUpRight size={20} />
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="services-footnote">
              <span>
                Have something different in mind? We’d love to hear it.
              </span>
              <Link to="/contact">
                Let’s find the right solution <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:4">
        <section className="why-section">
          <div className="why-grid container">
            <div className="why-visual">
              <div className="approach-visual-heading">
                <span>CONNECTED THINKING</span>
                <span>01 — 03</span>
              </div>
              <div className="why-visual-grid" />
              <div className="why-orbit">
                <div className="why-core">
                  <Code2 size={53} />
                </div>
                <span className="orbit-node node-a">
                  <Layers size={20} />
                  <b>Design</b>
                </span>
                <span className="orbit-node node-b">
                  <ShieldCheck size={20} />
                  <b>Trust</b>
                </span>
                <span className="orbit-node node-c">
                  <Braces size={21} />
                  <b>Engineering</b>
                </span>
                <span className="orbit-node node-d">
                  <Sparkles size={20} />
                  <b>Possibility</b>
                </span>
              </div>
              <div className="why-visual-caption">
                <span className="status-dot" />
                YOUR VISION, CONNECTED.
              </div>
              <div className="approach-principles">
                <span>Understand</span>
                <ArrowRight size={14} />
                <span>Build</span>
                <ArrowRight size={14} />
                <span>Grow</span>
              </div>
            </div>
            <div className="why-copy">
              <Eyebrow>THE HARSHAWEB APPROACH</Eyebrow>
              <h2>
                Good technology.
                <br />
                <span>Even better partnership.</span>
              </h2>
              <p>
                Great digital work begins with understanding your business. We
                connect the dots between what you need today and where you want
                to go next.
              </p>
              <div className="why-points">
                {[
                  [
                    "Clarity, from day one.",
                    "Clear scope, considered decisions and a shared understanding of what success looks like.",
                  ],
                  [
                    "Built for the real world.",
                    "Accessible experiences, maintainable systems and thoughtful engineering at every layer.",
                  ],
                  [
                    "Your goals. Our shared focus.",
                    "A collaborative process that keeps you involved, informed and ready for the next step.",
                  ],
                ].map(([title, description]) => (
                  <div key={title}>
                    <span>
                      <Check size={15} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link className="text-link" to="/about">
                Get to know Harshaweb <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:5">
        <section className="section">
          <div className="container">
            <SectionHeading
              eyebrow="FROM IDEA TO IMPACT"
              title="A clear path to something great."
              to="/process"
              label="Our process"
            />
            <div className="process-grid">
              {process.map(([title, description], i) => (
                <div className="process-step" key={title}>
                  <div className="process-top">
                    <span>0{i + 1}</span>
                    <div />
                    <ArrowRight size={16} />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:6">
        <section className="section work-section">
          <div className="container">
            <SectionHeading
              eyebrow="POSSIBILITIES, MADE TANGIBLE"
              title="A glimpse of what we can build."
              description="Original demonstration concepts that bring our thinking to life. Your project could be next."
              to="/portfolio"
              label="Explore our work"
            />
            <div className="featured-projects">
              {content.projects.slice(0, 2).map((project) => (
                <Link
                  className="project-card"
                  key={project.id}
                  to={`/portfolio/${project.slug}`}
                >
                  <div className="project-image-wrap">
                    <ProjectArt
                      kind={project.cover}
                      alt={`${project.title} — demonstration project preview`}
                    />
                    <span className="demo-label">DEMONSTRATION CONCEPT</span>
                    <span className="project-arrow">
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
                  <div className="project-info">
                    <div>
                      <span className="eyebrow">{project.industry}</span>
                      <h3>{project.title}</h3>
                    </div>
                    <span className="project-type">{project.services[0]}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:7">
        <section className="industry-section">
          <div className="industry-grid container">
            <div>
              <Eyebrow>BUILT FOR YOUR WORLD</Eyebrow>
              <h2>
                Different industries.
                <br />
                One thoughtful approach.
              </h2>
              <p>
                Every business has its own moving parts. We build around yours.
              </p>
              <Link className="text-link" to="/industries">
                Find your industry <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="industry-links">
              {content.industries.map((industry, i) => (
                <Link to={`/industries/${industry.slug}`} key={industry.id}>
                  <span className="industry-index">0{i + 1}</span>
                  {industry.title}
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:8">
        <section className="tech-section">
          <div className="container">
            <div>
              <Eyebrow>THE RIGHT TOOLS FOR THE RIGHT JOB</Eyebrow>
              <h2>Modern foundations. Lasting possibilities.</h2>
            </div>
            <div className="tech-logos">
              {[
                ["⚛", "React"],
                ["N", "Next.js"],
                ["⬡", "Node.js"],
                ["TS", "TypeScript"],
                ["◉", "PostgreSQL"],
                ["☁", "AWS"],
              ].map(([icon, name]) => (
                <Link to="/technology" key={name}>
                  <b className={name === "TypeScript" ? "ts-icon" : ""}>
                    {icon}
                  </b>
                  <span>{name}</span>
                </Link>
              ))}
            </div>
            <p>
              Technology is a choice, not a checklist. We select the stack that
              fits your goals.
            </p>
          </div>
        </section>
      </ManagedSection>
      <VideoSection />
      <ManagedSection id="home:Home:9">
        <section className="enquiry-section" id="project-enquiry">
          <div className="enquiry-grid container">
            <div className="enquiry-copy">
              <Eyebrow>BIG IDEAS START WITH A CONVERSATION</Eyebrow>
              <h2>
                You bring the vision.
                <br />
                <span>Let’s build the rest.</span>
              </h2>
              <p>
                A new website. A smarter workflow. Your next digital product.
                Tell us what you’re thinking — we’ll help you find a way
                forward.
              </p>
              <div className="enquiry-note">
                <span>
                  <ArrowUpRight size={23} />
                </span>
                <div>
                  <b>No pressure. Just possibilities.</b>
                  <p>
                    A thoughtful conversation about your goals,
                    <br />
                    and an honest view of how we can help.
                  </p>
                </div>
              </div>
              <span className="enquiry-coordinates">
                HARSHAWEB <Circle size={5} fill="currentColor" /> IDEAS INTO
                EXPERIENCES
              </span>
            </div>
            <DeferredEnquiry />
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:10">
        <section className="section faq-section">
          <div className="faq-grid container">
            <div>
              <Eyebrow>A LITTLE MORE CLARITY</Eyebrow>
              <h2>
                Good questions.
                <br />
                Straight answers.
              </h2>
              <p>Still have something on your mind?</p>
              <Link to="/contact" className="text-link">
                Let’s talk it through <ArrowUpRight size={16} />
              </Link>
            </div>
            <FaqList
              items={content.faqs.filter((f) => !f.serviceId).slice(0, 5)}
            />
          </div>
        </section>
      </ManagedSection>
      <ManagedSection id="home:Home:11">
        <section className="section insights-section">
          <div className="container">
            <SectionHeading
              eyebrow="IDEAS & PERSPECTIVES"
              title="A little insight goes a long way."
              to="/resources"
              label="More from our journal"
            />
            <div className="article-grid">
              {content.posts.slice(0, 3).map((post) => (
                <Link
                  to={`/resources/${post.slug}`}
                  className="article-card"
                  key={post.id}
                >
                  <ArticleArt
                    kind={post.cover}
                    alt={`${post.title} — editorial illustration`}
                  />
                  <div className="article-meta">
                    <span>
                      {content.categories.find((c) => c.id === post.categoryId)
                        ?.title || "Insights"}
                    </span>
                    <span>
                      {/^post-\d+$/.test(post.id)
                        ? "EDITORIAL SAMPLE"
                        : "HARSHAWEB EDITORIAL"}
                    </span>
                  </div>
                  <h3>{post.title}</h3>
                  <span className="text-link">
                    Read the perspective <ArrowUpRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </ManagedSection>
    </>
  )
}
