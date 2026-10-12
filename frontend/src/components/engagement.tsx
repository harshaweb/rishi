import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowUpRight,
  CalendarDays,
  Mail,
  MessageCircle,
  Phone,
  Play,
  X,
} from "lucide-react"
import { configuredVideos, whatsappUrl } from "../../../server/shared/engagement"
import { useContent } from "../lib/content"
import { useSectionCopy } from "./managed-section"
import { ButtonLink, Eyebrow } from "./ui"

export function VideoCard({
  video,
}: {
  video: ReturnType<typeof configuredVideos>[number]
}) {
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <article className="video-card">
      <div className="video-stage">
        {!playing ? (
          <button
            className="video-poster"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${video.title}`}
          >
            <span className="video-orbit" aria-hidden="true" />
            <span className="video-wordmark">
              harshaweb<span>.</span>
            </span>
            <span className="video-play">
              <Play size={26} fill="currentColor" />
            </span>
            <strong>{video.title}</strong>
            <span>
              {video.source.kind === "embed"
                ? "Load external video · YouTube or Vimeo"
                : video.source.src === "/videos/harshaweb-process.mp4"
                  ? "WATCH THE OVERVIEW · 24 SECONDS"
                  : "WATCH THE VIDEO"}
            </span>
          </button>
        ) : video.source.kind === "file" ? (
          <video
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={video.title}
            onError={() => setFailed(true)}
          >
            <source
              src={video.source.src}
              type={
                video.source.src.endsWith("webm") ? "video/webm" : "video/mp4"
              }
            />
            Your browser does not support this video. Read its transcript below.
          </video>
        ) : (
          <iframe
            src={video.source.src}
            title={video.title}
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
      <div className="video-copy">
        <h3>{video.title}</h3>
        <p>{video.description}</p>
        {failed && (
          <p role="alert">
            This video could not load. Please try again later or read the
            transcript.
          </p>
        )}
        {video.source.kind === "embed" && (
          <p className="video-privacy">
            The player connects to YouTube or Vimeo only when you choose to load
            it.
          </p>
        )}
        {video.transcript && (
          <details className="video-transcript">
            <summary>Read video transcript</summary>
            <p>{video.transcript}</p>
          </details>
        )}
      </div>
    </article>
  )
}
export function VideoSection() {
  const copy = useSectionCopy("home:video")
  const { content } = useContent()
  const video = configuredVideos(content.settings)[0]
  if (!video || copy.hidden) return null
  return (
    <section
      className="section video-feature container"
      aria-label="Harshaweb video introduction"
    >
      <div>
        <Eyebrow>GET TO KNOW THE PROCESS</Eyebrow>
        <h2>
          {copy.title || (
            <>
              See how your next
              <br />
              chapter comes together.
            </>
          )}
        </h2>
        <p>
          {copy.description ||
            "From your first idea to a considered launch. Take a quick look at the steps behind a dependable digital experience."}
        </p>
        <ButtonLink to="/videos" secondary>
          Explore our videos
        </ButtonLink>
        <Link className="text-link" to="/book-a-consultation">
          Book a conversation <ArrowUpRight size={16} />
        </Link>
      </div>
      <VideoCard video={video} />
    </section>
  )
}
export function ContactChannels({ compact = false }: { compact?: boolean }) {
  const { settings } = useContent().content
  return (
    <div className={`contact-channels ${compact ? "compact" : ""}`}>
      {settings.contactPhone && (
        <a href={`tel:${settings.contactPhone.replace(/[^+\d]/g, "")}`}>
          <Phone size={18} />
          <span>
            <small>Call us</small>
            {settings.contactPhone}
          </span>
        </a>
      )}
      {settings.contactEmail && (
        <a href={`mailto:${settings.contactEmail}`}>
          <Mail size={18} />
          <span>
            <small>Email us</small>
            {settings.contactEmail}
          </span>
        </a>
      )}
      {settings.whatsappPhone && (
        <a
          href={whatsappUrl(settings.whatsappPhone)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={18} />
          <span>
            <small>Chat on WhatsApp</small>
            {settings.whatsappPhone}
          </span>
          <ArrowUpRight size={15} />
        </a>
      )}
      {settings.businessHours && (
        <p className="business-hours">{settings.businessHours}</p>
      )}
      <Link to="/book-a-consultation">
        <CalendarDays size={18} />
        <span>
          <small>Find the next step</small>Book a consultation
        </span>
      </Link>
      {settings.bookingUrl && (
        <a href={settings.bookingUrl} target="_blank" rel="noopener noreferrer">
          <CalendarDays size={18} />
          <span>
            <small>Live booking calendar</small>Choose an available time
          </span>
          <ArrowUpRight size={15} />
        </a>
      )}
      {settings.address && (
        <div className="contact-address">
          <p>{settings.address}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get directions <ArrowUpRight size={15} />
          </a>
        </div>
      )}
    </div>
  )
}
export function SocialLinks() {
  const { settings } = useContent().content
  const links = [
    ["LinkedIn", settings.linkedinUrl],
    ["Instagram", settings.instagramUrl],
    ["Facebook", settings.facebookUrl],
    ["YouTube", settings.youtubeUrl],
  ].filter(([, url]) => url)
  if (!links.length) return null
  return (
    <nav className="social-links" aria-label="Harshaweb social profiles">
      {links.map(([label, url]) => (
        <a key={label} href={url} target="_blank" rel="noopener noreferrer">
          {label}
          <ArrowUpRight size={13} />
        </a>
      ))}
    </nav>
  )
}
export function ContactWidget() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <aside
      className="contact-widget"
      aria-label="Quick contact"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      {open && (
        <div className="contact-widget-panel" id="quick-contact-panel">
          <h2>Let’s talk about your idea.</h2>
          <p>Choose how you’d like to get in touch.</p>
          <ContactChannels compact />
          <Link className="button" to="/contact">
            Send an enquiry <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      <button
        className="contact-widget-trigger"
        ref={trigger}
        aria-expanded={open}
        aria-controls="quick-contact-panel"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        <span>{open ? "Close contact" : "Let’s talk"}</span>
      </button>
    </aside>
  )
}
