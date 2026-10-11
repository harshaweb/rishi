import { useState } from "react"
import { Link } from "react-router-dom"
import { CalendarDays, CheckCircle2 } from "lucide-react"
import { configuredVideos } from "../../shared/engagement"
import { allPublicRoutes, pageMetadata } from "../../shared/seo"
import { useContent } from "../lib/content"
import { api, ApiError } from "../lib/api"
import { trackEvent } from "../lib/analytics"
import { ContactChannels, VideoCard } from "../components/engagement"
import { CTA, PageHero } from "../components/ui"

export function Videos() {
  const { content } = useContent()
  const videos = configuredVideos(content.settings)
  return (
    <>
      <PageHero
        eyebrow="Harshaweb on screen"
        title="A little clarity. In motion."
        description="Watch our process overview and explore videos selected by the Harshaweb team. Every video has playback controls; external players load only when you choose."
      />
      <section className="section container">
        <div className="video-library">
          {videos.map((video) => (
            <VideoCard video={video} key={video.id} />
          ))}
        </div>
        {!videos.length && (
          <div className="empty-state">
            <h2>New perspectives are on their way.</h2>
            <p>
              Explore our process or arrange a conversation in the meantime.
            </p>
            <Link className="button" to="/process">
              Explore our process
            </Link>
          </div>
        )}
      </section>
      <CTA />
    </>
  )
}
export function VisionMission() {
  const { settings } = useContent().content
  return (
    <>
      <PageHero
        eyebrow="OUR DIRECTION"
        title="A clear purpose. A thoughtful way forward."
        description="The vision and mission that guide how we approach digital products, technology and working relationships."
      />
      <section className="section vision-grid container">
        <article>
          <span className="eyebrow">OUR VISION</span>
          <h2>Where we want to go.</h2>
          <p>{settings.vision}</p>
        </article>
        <article>
          <span className="eyebrow">OUR MISSION</span>
          <h2>How we move forward.</h2>
          <p>{settings.mission}</p>
        </article>
      </section>
      <CTA />
    </>
  )
}
export function Consultation() {
  const { content } = useContent()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [reference, setReference] = useState("")
  const [submissionId] = useState(() => crypto.randomUUID())
  return (
    <>
      <PageHero
        eyebrow="LET’S FIND THE RIGHT NEXT STEP"
        title="A good project starts with a conversation."
        description="Request a discovery call about your goals, scope and next steps. Suggest a time that works for you; our team will confirm availability before any meeting is booked."
      />
      <section className="section contact-grid container">
        <div>
          <CalendarDays size={36} />
          <h2>
            Bring your questions.
            <br />
            We’ll bring a practical perspective.
          </h2>
          <p>
            Tell us where you are now, what you want to achieve and what you
            need help with.
          </p>
          <ContactChannels />
        </div>
        {reference ? (
          <div className="form-success" role="status">
            <CheckCircle2 size={42} />
            <h2>Your consultation request is saved.</h2>
            <p>
              Reference: <strong>{reference}</strong>. Your preferred time is a
              request and has not been confirmed. No calendar invitation has
              been sent.
            </p>
            <Link to="/contact" className="text-link">
              More contact options
            </Link>
          </div>
        ) : (
          <form
            className="lead-form"
            onSubmit={async (event) => {
              event.preventDefault()
              setError("")
              setPending(true)
              const form = new FormData(event.currentTarget)
              const time = String(form.get("preferredTime") || "")
              const date = time ? new Date(time) : null
              if (
                date &&
                (!Number.isFinite(date.getTime()) ||
                  date.getTime() <= Date.now())
              ) {
                setError("Choose a future preferred time or leave it blank.")
                setPending(false)
                return
              }
              const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
              try {
                const result = await api<{ reference: string }>("/api/leads", {
                  method: "POST",
                  body: JSON.stringify({
                    submissionId,
                    name: form.get("name"),
                    email: form.get("email"),
                    phone: form.get("phone"),
                    company: form.get("company"),
                    service: form.get("service"),
                    budget: "Let’s discuss",
                    timeline: "Exploring options",
                    website: "",
                    kind: "contact",
                    companyFax: form.get("companyFax"),
                    consent: form.get("consent") === "on",
                    message: `Consultation request. Preferred time: ${date ? `${date.toISOString()} (${timezone})` : "Please arrange by email"}.\nProject context: ${form.get("message")}`,
                  }),
                })
                setReference(result.reference)
                trackEvent("generate_lead")
              } catch (err) {
                setError(
                  err instanceof ApiError && Object.keys(err.fields).length
                    ? Object.values(err.fields).join(" ")
                    : err instanceof Error
                      ? err.message
                      : "Your request could not be saved. Please try again."
                )
              } finally {
                setPending(false)
              }
            }}
          >
            <h3>Request your discovery call.</h3>
            <p className="muted">
              All fields are required except your preferred time.
            </p>
            <div className="form-grid">
              {[
                ["name", "Full name", "text"],
                ["email", "Business email", "email"],
                ["phone", "Phone with country code", "tel"],
                ["company", "Company name", "text"],
              ].map(([name, label, type]) => (
                <div className="field" key={name}>
                  <label htmlFor={`consult-${name}`}>{label} *</label>
                  <input
                    id={`consult-${name}`}
                    name={name}
                    type={type}
                    required
                    maxLength={name === "phone" ? 30 : 150}
                    autoComplete={
                      name === "name"
                        ? "name"
                        : name === "email"
                          ? "email"
                          : name === "phone"
                            ? "tel"
                            : "organization"
                    }
                    placeholder={
                      name === "phone" ? "+91 98765 43210" : undefined
                    }
                    pattern={
                      name === "phone"
                        ? "\\+[1-9][0-9 \\(\\)\\-]{6,24}"
                        : undefined
                    }
                  />
                </div>
              ))}
              <div className="field">
                <label htmlFor="consult-service">Service required *</label>
                <select id="consult-service" name="service" required>
                  <option>Not sure yet</option>
                  {content.services.map((service) => (
                    <option key={service.id}>{service.title}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="consult-time">Preferred date and time</label>
                <input
                  id="consult-time"
                  name="preferredTime"
                  type="datetime-local"
                  aria-describedby="consult-time-help"
                />
                <small id="consult-time-help">
                  Your browser’s local timezone. Availability will be confirmed
                  separately.
                </small>
              </div>
              <div className="field full-width">
                <label htmlFor="consult-message">
                  What would you like to discuss? *
                </label>
                <textarea
                  id="consult-message"
                  name="message"
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={4}
                />
              </div>
            </div>
            <div className="honeypot" aria-hidden="true">
              <label>
                Leave empty
                <input name="companyFax" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" name="consent" required />
              <span>
                I agree to the <Link to="/privacy-policy">Privacy Policy</Link>{" "}
                and to being contacted about this request. *
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" disabled={pending}>
              {pending ? "Saving your request…" : "Request a consultation"}
            </button>
          </form>
        )}
      </section>
    </>
  )
}
export function SiteMap() {
  const { content } = useContent()
  return (
    <>
      <PageHero
        eyebrow="FIND YOUR WAY"
        title="Everything, in one place."
        description="Explore Harshaweb’s services, industries, videos, resources and contact options."
      />
      <nav
        className="section html-sitemap container"
        aria-label="Website sitemap"
      >
        {allPublicRoutes(content)
          .filter((path) => path !== "/site-map")
          .map((path) => (
            <Link key={path} to={path}>
              {pageMetadata(path, content).title.replace(" | Harshaweb", "")}
            </Link>
          ))}
      </nav>
    </>
  )
}
