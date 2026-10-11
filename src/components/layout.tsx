import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import {
  ArrowUpRight,
  ChevronDown,
  Code2,
  Menu,
  X,
  ArrowRight,
  Phone,
} from "lucide-react"
import { useContent } from "../lib/content"
import { ButtonLink } from "./ui"
import { Newsletter } from "./newsletter"
import { SocialLinks } from "./engagement"
import { whatsappUrl } from "../../shared/engagement"
import { useSectionCopy } from "./managed-section"

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Harshaweb home">
      <span className="logo-symbol">
        <Code2 size={24} strokeWidth={2.6} />
      </span>
      harshaweb<span className="logo-dot">.</span>
    </Link>
  )
}
export function Header() {
  const copy = useSectionCopy("header")
  const { content } = useContent()
  const [menu, setMenu] = useState(false)
  const [dropdown, setDropdown] = useState("")
  const location = useLocation()
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  useEffect(() => {
    function close(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) {
        setDropdown("")
        setMenu(false)
      }
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [])
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="announcement">
        <span>{content.settings.announcement}</span>
        {content.settings.contactPhone ? (
          <a
            href={`tel:${content.settings.contactPhone.replace(/[^+\d]/g, "")}`}
          >
            <Phone size={12} /> {content.settings.contactPhone}
          </a>
        ) : (
          <Link to="/request-a-quote">
            Let’s talk <ArrowUpRight size={13} />
          </Link>
        )}
      </div>
      <header
        className="site-header"
        ref={root}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDropdown("")
            setMenu(false)
            root.current
              ?.querySelector<HTMLButtonElement>(
                menu ? ".mobile-toggle" : '.nav-toggle[aria-expanded="true"]'
              )
              ?.focus()
          }
        }}
      >
        <div className="header-inner container">
          <Logo />
          <button
            className="mobile-toggle"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="primary-navigation"
            onClick={() => {
              setMenu(!menu)
              setDropdown("")
            }}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            id="primary-navigation"
            className={`primary-nav ${menu ? "open" : ""}`}
            aria-label="Main navigation"
          >
            <NavLink to="/" end>
              Home
            </NavLink>
            <div className="nav-group">
              <button
                className={`nav-toggle ${location.pathname.startsWith("/services") ? "active" : ""}`}
                aria-expanded={dropdown === "services"}
                aria-controls="services-dropdown"
                onClick={() =>
                  setDropdown(dropdown === "services" ? "" : "services")
                }
              >
                Services <ChevronDown size={13} />
              </button>
              {dropdown === "services" && (
                <div className="nav-dropdown mega-menu" id="services-dropdown">
                  <div className="dropdown-intro">
                    <span className="eyebrow">WHAT WE DO</span>
                    <h3>
                      Built around
                      <br />
                      your next move.
                    </h3>
                    <Link to="/services" className="text-link">
                      All services <ArrowRight size={15} />
                    </Link>
                  </div>
                  <div>
                    {content.services.map((service) => (
                      <Link key={service.id} to={`/services/${service.slug}`}>
                        {service.title}
                        <ArrowUpRight size={12} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <NavLink to="/portfolio">Our work</NavLink>
            <NavLink to="/industries">Industries</NavLink>
            <div className="nav-group">
              <button
                className={`nav-toggle ${["/about", "/vision-and-mission", "/team", "/process", "/technology", "/careers", "/videos", "/book-a-consultation"].includes(location.pathname) ? "active" : ""}`}
                aria-expanded={dropdown === "company"}
                aria-controls="company-dropdown"
                onClick={() =>
                  setDropdown(dropdown === "company" ? "" : "company")
                }
              >
                Company <ChevronDown size={13} />
              </button>
              {dropdown === "company" && (
                <div className="nav-dropdown small-menu" id="company-dropdown">
                  {[
                    ["/about", "About us"],
                    ["/vision-and-mission", "Vision & Mission"],
                    ["/team", "Our team"],
                    ["/process", "Our process"],
                    ["/technology", "Technology stack"],
                    ["/careers", "Careers"],
                    ["/videos", "Videos"],
                    ["/book-a-consultation", "Book a consultation"],
                  ].map(([to, label]) => (
                    <Link key={to} to={to}>
                      {label}
                      <ArrowUpRight size={13} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <NavLink to="/resources">Insights</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
          <ButtonLink className="header-cta" to="/request-a-quote">
            {copy.title || "Let’s talk"}
          </ButtonLink>
        </div>
      </header>
    </>
  )
}
export function Footer() {
  const copy = useSectionCopy("footer")
  const newsletterCopy = useSectionCopy("newsletter")
  const { content } = useContent()
  const settings = content.settings
  const locations = settings.presenceLocations
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
  const phones = [
    [settings.contactPhone, settings.businessHours],
    [settings.contactPhone2, settings.contactPhone2Hours],
    [settings.contactPhone3, settings.contactPhone3Hours],
  ].filter(([phone]) => phone)
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-project">
          <div>
            <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
            <h2>
              {copy.title || (
                <>
                  Have an idea?
                  <br />
                  <span>Let’s bring it to life.</span>
                </>
              )}
            </h2>
            <p>
              {copy.description ||
                "Tell us what you have in mind. We’ll help you find the next step."}
            </p>
          </div>
          <ButtonLink to="/book-a-consultation">Book a consultation</ButtonLink>
        </div>
        <div className="footer-top footer-directory">
          <div className="footer-brand">
            <Logo />
            <p>{settings.companyDescription}</p>
            <Link className="footer-talk" to="/contact">
              Let’s build something that matters.
              <ArrowUpRight size={18} />
            </Link>
            <SocialLinks />
          </div>
          <div>
            <h3>Company</h3>
            {[
              ["/about", "About us"],
              ["/vision-and-mission", "Vision & Mission"],
              ["/resources", "Blogs"],
              ["/careers", "Careers"],
              ["/portfolio", "Our work"],
            ].map(([to, label]) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ))}
          </div>
          <div>
            <h3>Help & support</h3>
            {[
              ["/contact", "Help & enquiries"],
              ["/privacy-policy", "GDPR & Privacy Policy"],
              ["/terms-and-conditions", "Terms & Conditions"],
              ["/site-map", "Site Map"],
              ["/videos", "Videos"],
              ["/book-a-consultation", "Book a consultation"],
            ].map(([to, label]) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ))}
          </div>
          <div>
            <h3>Our Presence</h3>
            {locations.map((location) => (
              <Link key={location} to="/contact">
                {location}
              </Link>
            ))}
            {!locations.length && (
              <p className="footer-location-note">
                Talk to us about your project location.
              </p>
            )}
            <Link to="/book-a-consultation">
              Online consultations <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="footer-contact">
            <h3>Contact Us</h3>
            {phones.map(([phone, hours]) => (
              <div className="footer-phone" key={phone}>
                <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>
                  <Phone size={15} />
                  {phone}
                </a>
                {hours && <small>{hours}</small>}
              </div>
            ))}
            {settings.whatsappPhone && (
              <div className="footer-phone">
                <a
                  href={whatsappUrl(settings.whatsappPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {settings.whatsappPhone}
                </a>
                <small>WhatsApp only</small>
              </div>
            )}
            {settings.address && (
              <p className="footer-address">
                <strong>Address:</strong> {settings.address}
              </p>
            )}
            {settings.contactEmail && (
              <a
                className="footer-email"
                href={`mailto:${settings.contactEmail}`}
              >
                Email: {settings.contactEmail}
              </a>
            )}
            {!phones.length &&
              !settings.whatsappPhone &&
              !settings.contactEmail && (
                <p className="footer-location-note">
                  Share your questions or project requirements through our
                  enquiry form.
                </p>
              )}
            <Link className="footer-enquiry" to="/contact">
              Send an enquiry <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
        <div className="footer-subscribe-row">
          <div>
            <h3>
              {newsletterCopy.title || "A little perspective, in your inbox."}
            </h3>
            <p>
              {newsletterCopy.description ||
                "Ideas on design, technology and building better."}
            </p>
          </div>
          <div className="footer-newsletter">
            <Newsletter compact />
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Harshaweb. Built with purpose.
          </span>
          <div>
            <Link to="/privacy-policy">Privacy</Link>
            <Link to="/terms-and-conditions">Terms</Link>
            <Link to="/cookie-policy">Cookies</Link>
            <Link to="/admin">
              Staff login <ArrowUpRight size={11} />
            </Link>
          </div>
          <span className="footer-domain">
            harshaweb.com <span>↗</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
export function CookieChoice() {
  const [choice, setChoice] = useState<string | null>("loading")
  useEffect(() => {
    // Read browser storage after hydration so server and first client render agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(localStorage.getItem("harshaweb-consent"))
  }, [])
  if (choice) return null
  return (
    <aside className="cookie-choice" aria-label="Cookie preferences">
      <div>
        <b>Your privacy, by design.</b>
        <p>
          We use essential cookies for staff login. Optional analytics remain
          off unless you choose to allow them.{" "}
          <Link to="/cookie-policy">Learn more</Link>
        </p>
      </div>
      <button
        className="button button-secondary"
        onClick={() => {
          localStorage.setItem("harshaweb-consent", "essential")
          setChoice("essential")
        }}
      >
        Essential only
      </button>
      <button
        className="button"
        onClick={() => {
          localStorage.setItem("harshaweb-consent", "optional")
          setChoice("optional")
          window.dispatchEvent(new Event("harshaweb-consent"))
        }}
      >
        Allow optional
      </button>
    </aside>
  )
}
