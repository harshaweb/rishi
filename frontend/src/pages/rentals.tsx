import { rentalCheckout } from "../lib/rental-checkout"
import { RentalCalendar } from "../components/rental-calendar"
import { availableStay, unavailableNight } from "../lib/stay-dates"
import { newOwnerPhotos } from "../lib/uploaded-photos"
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom"
import {
  Search,
  Heart,
  Globe2,
  Menu,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  MapPin,
  Star,
  Home,
  Mountain,
  Trees,
  Building2,
  Gem,
  Umbrella,
  PawPrint,
  Coffee,
  Sparkles,
  Users,
  BedDouble,
  Bath,
  Grid2X2,
  Share2,
  Wifi,
  CookingPot,
  Car,
  Wind,
  CalendarDays,
  ShieldCheck,
  CreditCard,
  ArrowUpRight,
  MessageCircle,
  Plus,
  Minus,
  X,
  Map as MapIcon,
} from "lucide-react"
import { useContent } from "../lib/content"
import {
  RentalDialog,
  RentalProvider,
  rentalRequest,
  useRental,
  useRentalResource,
} from "../rental-state"
import {
  rentalCategories,
  rentalAmenities,
  rentalMoney as money,
  rentalDate,
  type RentalProperty,
  type RentalBooking,
} from "../../../server/shared/rentals"
import { RentalWorkspace } from "./rental-workspace"
import { rentalCities } from "../../../server/shared/rental-region"
import { rentalContact } from "../../../server/shared/rental-contact"

const icons = [
  Building2,
  Mountain,
  Mountain,
  Umbrella,
  Trees,
  Gem,
  Building2,
  Home,
  Sparkles,
  PawPrint,
  Coffee,
  Users,
]
const today = () => new Date().toISOString().slice(0, 10)
const nextDate = (date: string, days = 1) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10)
export const rentalPaths = [
  "/",
  "/search",
  "/stays",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/profile",
  "/wishlists",
  "/trips",
  "/messages",
  "/notifications",
  "/host",
  "/admin",
  "/help",
  "/contact",
  "/terms",
  "/privacy",
  "/cancellation-policy",
  "/experiences",
]
export function isRentalPath(path: string) {
  return rentalPaths.some(
    (p) =>
      p === path ||
      (p !== "/" &&
        ["/stays", "/host", "/admin"].includes(p) &&
        path.startsWith(p + "/"))
  )
}
function hasPropertyCoordinates(property: RentalProperty) {
  return typeof property.latitude === "number" && Number.isFinite(property.latitude) &&
    typeof property.longitude === "number" && Number.isFinite(property.longitude)
}
function propertyMapUrl(property: RentalProperty) {
  return hasPropertyCoordinates(property)
    ? `https://www.openstreetmap.org/?mlat=${property.latitude}&mlon=${property.longitude}#map=13/${property.latitude}/${property.longitude}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${property.city}, India`)}`
}
function Brand() {
  return (
    <Link
      className="r-brand"
      to="/"
      aria-label="Omshivraj home"
      onClick={(event) => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
          window.scrollTo({ top: 0, left: 0, behavior: "instant" })
      }}
    >
      <span className="r-brand-symbol">
        <Home strokeWidth={2.4} />
        <Heart size={10} />
      </span>
      Omshivraj<span className="r-brand-dot">.</span>
    </Link>
  )
}
function SearchBar({ compact = false }: { compact?: boolean }) {
  const [params] = useSearchParams(),
    navigate = useNavigate()
  const [destination, setDestination] = useState(
      params.get("destination") || ""
    ),
    [checkIn, setCheckIn] = useState(params.get("checkIn") || ""),
    [checkOut, setCheckOut] = useState(params.get("checkOut") || "")
  const [adults, setAdults] = useState(
      Number(params.get("adults") || params.get("guests") || 1)
    ),
    [children, setChildren] = useState(Number(params.get("children") || 0)),
    [infants, setInfants] = useState(Number(params.get("infants") || 0)),
    [pets, setPets] = useState(Number(params.get("pets") || 0))
  const [panel, setPanel] = useState<"destination" | "dates" | "guests" | null>(
      null
    ),
    [error, setError] = useState("")
  const destinations = useRentalResource<{ city: string; count: number }[]>(
    panel === "destination"
      ? `/destinations?q=${encodeURIComponent(destination)}`
      : null
  )
  function search(e?: FormEvent) {
    e?.preventDefault()
    if (
      (checkIn && !checkOut) ||
      (!checkIn && checkOut) ||
      (checkIn && checkOut <= checkIn)
    ) {
      setError("Choose a checkout date after check-in.")
      setPanel("dates")
      return
    }
    const q = new URLSearchParams({
      destination,
      guests: String(adults + children),
      adults: String(adults),
      children: String(children),
      infants: String(infants),
      pets: String(pets),
    })
    if (checkIn) {
      q.set("checkIn", checkIn)
      q.set("checkOut", checkOut)
    }
    if (pets) q.set("amenities", "Pets allowed")
    navigate(`/search?${q}`)
    setPanel(null)
    setError("")
  }
  return (
    <div className={`r-search-wrap ${compact ? "compact" : ""}`}>
      <form className="r-search" onSubmit={search}>
        <button
          className="r-search-part where"
          type="button"
          onClick={() => setPanel("destination")}
        >
          <MapPin
            className="r-search-location-icon"
            size={20}
            aria-hidden="true"
          />
          <strong>Where</strong>
          <span>{destination || "Search destinations"}</span>
        </button>
        <span className="r-search-divider" />
        <button
          type="button"
          className="r-search-part"
          onClick={() => setPanel("dates")}
        >
          <strong>Check in</strong>
          <span>
            {checkIn
              ? rentalDate(checkIn).replace(/,? \d{4}$/, "")
              : "Add dates"}
          </span>
        </button>
        <span className="r-search-divider" />
        <button
          type="button"
          className="r-search-part"
          onClick={() => setPanel("dates")}
        >
          <strong>Check out</strong>
          <span>
            {checkOut
              ? rentalDate(checkOut).replace(/,? \d{4}$/, "")
              : "Add dates"}
          </span>
        </button>
        <span className="r-search-divider" />
        <button
          type="button"
          className="r-search-part guests"
          onClick={() => setPanel("guests")}
        >
          <strong>Who</strong>
          <span>
            {adults + children > 1
              ? `${adults + children} guests`
              : "Add guests"}
            {pets ? `, ${pets} pet${pets > 1 ? "s" : ""}` : ""}
          </span>
        </button>
        <button type="submit" className="r-search-go" aria-label="Search stays">
          <Search size={21} />
          <span>Search</span>
        </button>
      </form>
      {panel && (
        <RentalDialog
          title={
            panel === "destination"
              ? "Where to?"
              : panel === "dates"
                ? "When’s your getaway?"
                : "Who’s coming?"
          }
          close={() => setPanel(null)}
        >
          {panel === "destination" ? (
            <>
              <label className="r-input-label">
                Search destinations
                <input
                  autoFocus
                  placeholder="Delhi, Gurugram, Noida…"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </label>
              <p className="r-muted r-small">
                Stays exclusively in Delhi & Delhi NCR
              </p>
              <div className="r-destination-options">
                {(destinations.data || []).map((d, i) => (
                  <button
                    key={d.city}
                    onClick={() => {
                      setDestination(d.city)
                      setPanel("dates")
                    }}
                  >
                    <span className={`r-location-icon color-${i}`}>
                      <MapPin />
                    </span>
                    <span>
                      <b>{d.city}, India</b>
                      <small>{d.count} places to make yourself at home</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
              {destinations.data?.length === 0 && (
                <p className="r-muted r-small">
                  No stays found here. Try Delhi, Gurugram, Noida or another
                  Delhi NCR city.
                </p>
              )}
              <button
                className="r-text-button"
                onClick={() => {
                  setDestination("")
                  setPanel(null)
                }}
              >
                I’m flexible — explore everywhere
              </button>
            </>
          ) : panel === "dates" ? (
            <>
              <div className="r-date-fields">
                <label className="r-input-label">
                  Check in
                  <input
                    aria-label="Search check-in"
                    type="date"
                    min={today()}
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value)
                      if (checkOut <= e.target.value)
                        setCheckOut(nextDate(e.target.value))
                    }}
                  />
                </label>
                <label className="r-input-label">
                  Check out
                  <input
                    aria-label="Search check-out"
                    type="date"
                    min={checkIn ? nextDate(checkIn) : nextDate(today())}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                  />
                </label>
              </div>
              <div className="r-date-note">
                <CalendarDays />
                <div>
                  <b>A change of scenery, on your schedule.</b>
                  <p>
                    Choose up to 90 nights. Availability is checked with each
                    search.
                  </p>
                </div>
              </div>
              {error && (
                <p className="r-error" role="alert">
                  {error}
                </p>
              )}
              <div className="r-modal-actions">
                <button
                  className="r-text-button"
                  onClick={() => {
                    setCheckIn("")
                    setCheckOut("")
                    setError("")
                  }}
                >
                  Clear dates
                </button>
                <button
                  className="r-primary"
                  onClick={() => {
                    if (checkIn && checkOut <= checkIn) {
                      setError("Checkout must be after check-in.")
                      return
                    }
                    setPanel("guests")
                  }}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <Counter
                name="Adults"
                description="Ages 13 or above"
                value={adults}
                min={1}
                max={20}
                set={setAdults}
              />
              <Counter
                name="Children"
                description="Ages 2–12"
                value={children}
                min={0}
                max={10}
                set={setChildren}
              />
              <Counter
                name="Infants"
                description="Under 2"
                value={infants}
                min={0}
                max={5}
                set={setInfants}
              />
              <Counter
                name="Pets"
                description="Only show pet-friendly stays"
                value={pets}
                min={0}
                max={2}
                set={setPets}
              />
              <div className="r-modal-actions">
                <button
                  className="r-text-button"
                  onClick={() => {
                    setAdults(1)
                    setChildren(0)
                    setInfants(0)
                    setPets(0)
                  }}
                >
                  Reset guests
                </button>
                <button className="r-primary" onClick={() => search()}>
                  Search stays <Search size={17} />
                </button>
              </div>
            </>
          )}
        </RentalDialog>
      )}
    </div>
  )
}
function Counter({
  name,
  description,
  value,
  min,
  max,
  set,
}: {
  name: string
  description: string
  value: number
  min: number
  max: number
  set: (n: number) => void
}) {
  return (
    <div className="r-counter">
      <div>
        <b>{name}</b>
        <small>{description}</small>
      </div>
      <div>
        <button
          aria-label={`Remove ${name.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => set(value - 1)}
        >
          <Minus size={15} />
        </button>
        <span aria-live="polite">{value}</span>
        <button
          aria-label={`Add ${name.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => set(value + 1)}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}
function Header() {
  const { session, refreshSession, notify } = useRental(),
    location = useLocation(),
    navigate = useNavigate()
  const [menu, setMenu] = useState(false),
    [locale, setLocale] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenu(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false)
    }
    document.addEventListener("click", close)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("click", close)
      document.removeEventListener("keydown", escape)
    }
  }, [])
  const home = location.pathname === "/" || location.pathname === "/search"
  const homepage = location.pathname === "/"
  const authNext = ["/login", "/signup"].includes(location.pathname)
    ? new URLSearchParams(location.search).get("next") || "/trips"
    : `${location.pathname}${location.search}`
  return (
    <header
      className={
        home
          ? "r-header r-header-refined r-header-new"
          : "r-header r-header-refined r-header-new r-header-small"
      }
    >
      <div className="r-header-ribbon">
        <span><MapPin size={12} aria-hidden="true" /> Your next chapter, in Delhi & NCR.</span>
        <a href={rentalContact.callUrl}>Let’s find your stay <span aria-hidden="true">·</span> {rentalContact.phone} <ArrowUpRight size={12} aria-hidden="true" /></a>
      </div>
      <div className="r-topbar">
        <div className="r-header-brand">
          <Brand />
          <span>MAKE YOURSELF AT HOME</span>
        </div>
        <nav className="r-main-tabs" aria-label="Main navigation">
          <Link
            className={home ? "active" : ""}
            aria-current={home ? "page" : undefined}
            to={homepage ? "/#all-flats" : "/"}
          >
            <span className="r-tab-art">
              <Home size={21} strokeWidth={1.8} />
            </span>
            <span>{homepage ? "Flats" : "Find a stay"}</span>
          </Link>
          <Link to={homepage ? "/#why-omshivraj" : "/help"} className={location.pathname === "/help" ? "active" : ""} aria-current={location.pathname === "/help" ? "page" : undefined}>{homepage ? "Why Omshivraj?" : "Help & support"}</Link>
        </nav>
        <div
          className={
            session?.user
              ? "r-header-actions"
              : "r-header-actions r-header-guest"
          }
        >
          <Link to="/host" className="r-host-link">
            {homepage ? "Property owners" : "Become a host"}
            <ArrowUpRight size={15} />
          </Link>
          <button
            className="r-icon-button"
            aria-label="Language and currency"
            onClick={() => setLocale(true)}
          >
            <Globe2 size={19} />
          </button>
          {!session?.user && (
            <nav className="r-header-auth" aria-label="Account access">
              <Link to={`/login?next=${encodeURIComponent(authNext)}`}>
                {homepage ? "Login / Join" : "Log in"}
              </Link>
              {!homepage && <Link
                className="r-header-signup"
                to={`/signup?next=${encodeURIComponent(authNext)}`}
              >
                Sign up
              </Link>}
            </nav>
          )}
          <div ref={ref} className="r-menu-wrap">
            <button
              aria-label="Open account menu"
              className="r-account-button"
              aria-expanded={menu}
              aria-controls={menu ? "r-account-navigation" : undefined}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={19} />
              <span className="r-avatar">
                {session?.user ? (
                  session.user.name.charAt(0).toUpperCase()
                ) : (
                  <Users size={15} />
                )}
              </span>
            </button>
            {menu && (
              <nav
                id="r-account-navigation"
                className="r-account-menu"
                aria-label="Account"
              >
                {session?.user ? (
                  <>
                    <b>Hello, {session.user.name.split(" ")[0]}</b>
                    <Link to="/trips" onClick={() => setMenu(false)}>
                      Trips
                    </Link>
                    <Link to="/wishlists" onClick={() => setMenu(false)}>
                      Wishlists
                    </Link>
                    <Link to="/messages" onClick={() => setMenu(false)}>
                      Messages
                    </Link>
                    <Link to="/notifications" onClick={() => setMenu(false)}>
                      Notifications
                    </Link>
                    <Link to="/profile" onClick={() => setMenu(false)}>
                      Account settings
                    </Link>
                    {["HOST", "ADMIN"].includes(session.user.role) && (
                      <Link to="/host/listings" onClick={() => setMenu(false)}>
                        Host workspace
                      </Link>
                    )}
                    {session.user.role === "ADMIN" && (
                      <Link to="/admin" onClick={() => setMenu(false)}>
                        Admin dashboard
                      </Link>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          await rentalRequest("/logout")
                          await refreshSession()
                          setMenu(false)
                          navigate("/")
                          notify("You’re logged out.")
                        } catch (e) {
                          notify((e as Error).message)
                        }
                      }}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/signup" onClick={() => setMenu(false)}>
                      <b>Sign up</b>
                    </Link>
                    <Link to="/login" onClick={() => setMenu(false)}>
                      Log in
                    </Link>
                  </>
                )}
                <hr />
                <Link to="/host" onClick={() => setMenu(false)}>
                  List your home
                </Link>
                <Link to="/help" onClick={() => setMenu(false)}>
                  Help centre
                </Link>
              </nav>
            )}
          </div>
        </div>
      </div>
      {home && <SearchBar key={location.search} />}{" "}
      {locale && (
        <RentalDialog
          title="Language & currency"
          close={() => setLocale(false)}
        >
          <div className="r-locale">
            <Globe2 size={32} />
            <h3>A little closer to home</h3>
            <p>
              Language: <b>English (India)</b>
            </p>
            <p>
              Currency: <b>Indian rupee · INR ₹</b>
            </p>
            <p className="r-muted">
              All charges and pricing are in INR. More languages and currencies
              will be added as the marketplace grows.
            </p>
            <button className="r-primary" onClick={() => setLocale(false)}>
              Done
            </button>
          </div>
        </RentalDialog>
      )}
    </header>
  )
}
export function RentalCard({ property: p }: { property: RentalProperty }) {
  const { saved, toggleSaved } = useRental()
  const [image, setImage] = useState(0),
    [busy, setBusy] = useState(false)
  return (
    <article className="r-card">
      <div className="r-card-photo">
        <Link to={`/stays/${p.slug}`} aria-label={`${p.title} in ${p.city}`}>
          <img
            src={p.images[image] || "/gallery/photo-01.jpg"}
            alt={`${p.type} in ${p.city}: ${p.title}`}
            loading="lazy"
          />
        </Link>
        <span className="r-card-tag">
          {!p.demo && p.reviewCount >= 5 && Number(p.rating) >= 4.8
            ? "Guest favourite"
            : p.type}
        </span>
        <button
          className={`r-favorite ${saved.has(p.id) ? "is-saved" : ""}`}
          aria-label={`${saved.has(p.id) ? "Remove" : "Save"} ${p.title}`}
          aria-pressed={saved.has(p.id)}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await toggleSaved(p)
            setBusy(false)
          }}
        >
          <Heart
            size={21}
            fill={saved.has(p.id) ? "currentColor" : "rgba(0,0,0,.35)"}
          />
        </button>
        {p.images.length > 1 && (
          <>
            <button
              className="r-card-arrow prev"
              aria-label={`Previous photo of ${p.title}`}
              onClick={() =>
                setImage((image + p.images.length - 1) % p.images.length)
              }
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="r-card-arrow next"
              aria-label={`Next photo of ${p.title}`}
              onClick={() => setImage((image + 1) % p.images.length)}
            >
              <ChevronRight size={16} />
            </button>
            <span className="r-photo-dots">
              {p.images.map((_, i) => (
                <i className={i === image ? "active" : ""} key={i} />
              ))}
            </span>
          </>
        )}
      </div>
      <Link to={`/stays/${p.slug}`} className="r-card-description">
        <div>
          <h3>{p.title}</h3>
          {p.reviewCount > 0 && <span className="r-rating">
            <Star size={10} fill="currentColor" />
            {Number(p.rating).toFixed(2)}
          </span>}
        </div>
        <p className="r-card-stay-meta">{p.type} · {p.capacity} guests</p>
        <div className="r-card-location-rate">
          <span className="r-card-city">{p.city}</span>
          <span className="r-card-rate"><b>{money(p.nightlyRate)}</b><small> / night</small></span>
        </div>
      </Link>
    </article>
  )
}
function Skeletons() {
  return (
    <div className="r-card-grid" aria-label="Loading stays" role="status">
      {Array.from({ length: 7 }, (_, i) => (
        <div className="r-skeleton" key={i}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}
function RentalVideo({ className = "", label, background = false, paused = false, source = "/videos/stay-short-02", poster }: { className?: string; label: string; background?: boolean; paused?: boolean; source?: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    const updatePreference = () => {
      setReducedMotion(preference.matches)
      if (preference.matches || paused) video.pause()
      else if (visible) void video.play().catch(() => {})
    }
    setReducedMotion(preference.matches)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.35
      if (visible) {
        if (video.getAttribute("src") !== `${source}.mp4`) video.src = `${source}.mp4`
        if (!paused && !preference.matches && document.visibilityState === "visible")
          void video.play().catch(() => {})
      } else video.pause()
    }, { threshold: [0, 0.35] })
    const tabVisibility = () => {
      if (document.hidden) video.pause()
      else if (visible && !paused && !preference.matches) void video.play().catch(() => {})
    }
    observer.observe(video)
    preference.addEventListener("change", updatePreference)
    document.addEventListener("visibilitychange", tabVisibility)
    return () => {
      observer.disconnect()
      preference.removeEventListener("change", updatePreference)
      document.removeEventListener("visibilitychange", tabVisibility)
      video.pause()
    }
  }, [source, paused])
  return (
    <video
      ref={ref}
      className={`r-property-video r-short-video ${className}`}
      controls={!background}
      autoPlay={!reducedMotion && !paused}
      aria-hidden={background || undefined}
      muted
      loop
      playsInline
      preload="none"
      poster={poster ?? (background ? "/gallery/photo-01.jpg" : `${source}.jpg`)}
      aria-label={label}
      onPlay={(event) => {
        // A queued play event can arrive after another visible clip paused it.
        if (event.currentTarget.paused) return
        document.querySelectorAll<HTMLVideoElement>("video.r-property-video").forEach((video) => {
          if (video !== event.currentTarget) video.pause()
        })
      }}
    >
      {!background && <>Your browser does not support video. <a href={`${source}.mp4`}>Open the video</a>.</>}
    </video>
  )
}
function PropertyCarousel({ items, title }: { items: RentalProperty[]; title: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ previous: false, next: false })
  useEffect(() => {
    const row = ref.current
    if (!row) return
    const update = () => {
      const previous = row.scrollLeft > 2
      const next = row.scrollLeft + row.clientWidth < row.scrollWidth - 2
      setEdges(current => current.previous === previous && current.next === next ? current : { previous, next })
    }
    const observer = new ResizeObserver(update)
    observer.observe(row)
    row.addEventListener("scroll", update, { passive: true })
    update()
    return () => { observer.disconnect(); row.removeEventListener("scroll", update) }
  }, [items.length])
  function move(direction: number) {
    const row = ref.current
    if (!row) return
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0
    row.scrollBy({ left: direction * (row.clientWidth + gap), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }
  return <div className="r-hotel-carousel-stage">
    <div className="r-card-row r-hotel-carousel" ref={ref} tabIndex={0} role="region" aria-label={`${title} properties`} onKeyDown={event => {
      if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return
      event.preventDefault()
      move(event.key === "ArrowRight" ? 1 : -1)
    }}>
      {items.map(property => <RentalCard key={property.id} property={property} />)}
    </div>
    <div className="r-row-arrows r-hotel-carousel-arrows">
      <button type="button" aria-label={`Previous ${title}`} disabled={!edges.previous} onClick={() => move(-1)}><ChevronLeft size={22} /></button>
      <button type="button" aria-label={`Next ${title}`} disabled={!edges.next} onClick={() => move(1)}><ChevronRight size={22} /></button>
    </div>
  </div>
}
function Section({
  title,
  subtitle,
  items,
  query,
}: {
  title: string
  subtitle?: string
  items: RentalProperty[]
  query?: string
}) {
  return (
    <section className="r-stay-section r-hotel-section">
      <div className="r-section-heading r-hotel-section-heading">
        <div>
          <Link to={`/search?${query || ""}`}>
            <h2>
              {title}
            </h2>
          </Link>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <PropertyCarousel items={items.slice(0, 12)} title={title} />
    </section>
  )
}
const previousUploadedPhotos = [
  "Wood-panelled bedroom with a balcony entrance",
  "Bedroom with patterned bedding and wooden feature walls",
  "Balcony seating with a small table and plants",
  "Bedroom entrance and illuminated ceiling",
  "Bedroom with wooden walls and a wall-mounted television",
  "Room detail with a waste bin on a tiled floor",
  "Neighbourhood view from the building",
  "Bedroom seating area and bedside lighting",
  "Bedroom with a decorative marble-effect wall",
  "Armchairs beneath colourful wall art",
  "Bedroom with curtains and a ceiling fan",
  "Bed and seating area with decorative wall panels",
  "Kitchenette with cabinets and a refrigerator",
  "Open-plan bedroom and sofa seating",
  "Double bed beneath wall-mounted air conditioning",
  "Kitchen counter with an induction hob and kettle",
  "Sofa seating with plants and decorative wall art",
  "Bathroom with a shower, basin and toilet",
  "Kitchen cabinets and a small dining table",
  "Living area with a sofa and coffee table",
  "Decorative interior wall and kitchen entrance",
  "Balcony with two chairs and a round table",
  "Bedroom with recessed ceiling lighting",
  "Open-plan room with a bed and lounge area",
  "Double bed with patterned bedding and bedside lighting",
].map((alt, index) => ({
  src: `/gallery/photo-${String(index + 1).padStart(2, "0")}.jpg`,
  alt,
}))
const uploadedPhotos = [...newOwnerPhotos, ...previousUploadedPhotos]

function HomePhotoGallery() {
  const [selected, setSelected] = useState<number | null>(null)
  const preview = [5, 2, 7, 1, 9]
  return (
    <section
      className="r-uploaded-gallery"
      aria-labelledby="home-gallery-title"
    >
      <div className="r-uploaded-gallery-heading">
        <div>
          <span className="r-kicker">A CLOSER LOOK</span>
          <h2 id="home-gallery-title">Explore the spaces.</h2>
          <p>Rooms, cosy corners and the views outside.</p>
        </div>
        <button className="r-secondary" onClick={() => setSelected(0)}>
          <Grid2X2 size={16} /> View all {uploadedPhotos.length} photos
        </button>
      </div>
      <div className="r-uploaded-gallery-preview">
        {preview.map((index) => (
          <button
            key={index}
            onClick={() => setSelected(index)}
            aria-label={`View photo ${index + 1}: ${uploadedPhotos[index].alt}`}
          >
            <img
              src={uploadedPhotos[index].src}
              alt={uploadedPhotos[index].alt}
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {selected !== null && (
        <RentalDialog
          title={`Photo ${selected + 1} of ${uploadedPhotos.length}`}
          close={() => setSelected(null)}
        >
          <div className="r-uploaded-photo-viewer">
            <img
              className="r-uploaded-photo-full"
              src={uploadedPhotos[selected].src}
              alt={uploadedPhotos[selected].alt}
            />
            <div className="r-uploaded-photo-controls">
              <button
                className="r-icon-button"
                aria-label="Previous photo"
                onClick={() =>
                  setSelected(
                    (selected + uploadedPhotos.length - 1) %
                      uploadedPhotos.length
                  )
                }
              >
                <ChevronLeft size={20} />
              </button>
              <p>{uploadedPhotos[selected].alt}</p>
              <button
                className="r-icon-button"
                aria-label="Next photo"
                onClick={() =>
                  setSelected((selected + 1) % uploadedPhotos.length)
                }
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="r-uploaded-photo-thumbnails">
              {uploadedPhotos.map((photo, index) => (
                <button
                  key={photo.src}
                  aria-label={`View photo ${index + 1}`}
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                >
                  <img src={photo.src} alt={photo.alt} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </RentalDialog>
      )}
    </section>
  )
}

function HomeFlatCatalogue({ items, loading }: { items: RentalProperty[]; loading: boolean }) {
  const [city, setCity] = useState("Delhi")
  const cities = ["Delhi", "Gurugram", "Noida", "Ghaziabad"]
  const visible = items.filter((property) => property.city === city)
  return (
    <section id="all-flats" className="r-flat-catalogue r-hotel-section" aria-labelledby="all-flats-heading">
      <div className="r-section-heading r-hotel-section-heading">
        <div>
          <h2 id="all-flats-heading">All flats in Delhi & NCR</h2>
          <p>{loading ? "Loading your full collection…" : `${items.length} places to make yourself at home.`}</p>
        </div>
        <Link className="r-secondary" to="/search"><SlidersHorizontal size={16} /> More filters</Link>
      </div>
      <div className="r-flat-city-filters r-city-tabs-only" aria-label="Filter flats by city">
        {cities.map((name) => (
          <button key={name} className={city === name ? "active" : ""} aria-pressed={city === name} onClick={() => setCity(name)}>
            {name}<span>{items.filter((property) => property.city === name).length}</span>
          </button>
        ))}
      </div>
      <p className="r-flat-result-count" role="status">Showing {visible.length} flats in {city}</p>
      <PropertyCarousel key={city} items={visible} title={`Flats in ${city}`} />
    </section>
  )
}
function HomePage() {
  const { content } = useContent()
  const initial = content.rentals || []
  const query = useRentalResource<{ items: RentalProperty[] }>("/search")
  const items = query.data?.items || initial
  const more = useRentalResource<{ items: RentalProperty[] }>("/search?page=2")
  const all = Array.from(new Map([...items, ...(more.data?.items || [])].map((property) => [property.id, property])).values())
  const [category, setCategory] = useState("")
  const [heroPaused, setHeroPaused] = useState(false)
  const navigate = useNavigate()
  return (
    <>
      <div className="r-container r-home">
        <div className="r-home-intro">
          <RentalVideo className="r-bloom-hero-video" label="Omshivraj property preview" source="/videos/homepage-tour-enhanced" poster="/videos/homepage-tour-enhanced.jpg" background paused={heroPaused} />
          <div className="r-home-hero-content">
            <h1>Your next stay.<br />Hello, Omshivraj.</h1>
            <p>Explore flats and homes across Delhi & NCR. Choose your dates, find the right space, and request your stay.</p>
            <form className="r-bloom-hero-search" action="/search" method="get" onSubmit={(event) => {
              event.preventDefault()
              const destination = String(new FormData(event.currentTarget).get("destination") || "")
              navigate(destination ? `/search?destination=${encodeURIComponent(destination)}` : "/search")
            }}>
              <Search size={20} aria-hidden="true" />
              <select name="destination" aria-label="Choose your destination" defaultValue="">
                <option value="">Book a stay in Delhi & NCR</option>
                {rentalCities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
              <button type="submit" aria-label="Search stays"><ArrowUpRight size={21} /></button>
            </form>
            <span className="r-bloom-direct"><ShieldCheck size={16} /> Direct requests. Host-confirmed stays.</span>
          </div>
          <button className="r-hero-film-toggle" type="button" onClick={() => setHeroPaused((value) => !value)} aria-pressed={heroPaused}>{heroPaused ? "Play video" : "Pause video"}</button>
        </div>
        <section className="r-bloom-welcome">
          <div>
            <h2>Your next stay,<br />made simple.</h2>
            <p>A city break, a work trip, or a little more time together. Find your place, explore the details, and keep every request in one account.</p>
            <a href="#all-flats" className="r-primary">Explore our stays <ArrowUpRight size={18} /></a>
          </div>
          <Link to="/search?destination=Delhi" className="r-bloom-welcome-photo">
            <img src={newOwnerPhotos[5].src} alt={newOwnerPhotos[5].alt} loading="lazy" />
            <span><b>Omshivraj.</b>Find your corner of Delhi & NCR.<ArrowUpRight size={20} /></span>
          </Link>
        </section>
        <div className="r-bloom-featured">
          <Section title="Stays across Delhi & NCR" subtitle="Explore our flats and homes in Delhi, Noida, Gurugram, and Ghaziabad." items={all} query="" />
        </div>
        <section id="why-omshivraj" className="r-bloom-benefits">
          <h2>The Omshivraj way.</h2>
          <p>A little more information. A little less guesswork. Make your next stay your own.</p>
          <div className="r-bloom-benefit-grid">
            {[
              { image: newOwnerPhotos[2].src, title: "Find your space", description: "Compare flats, villas, and homes. See the photos, amenities, and guest capacity before you choose." },
              { image: newOwnerPhotos[7].src, title: "Plan with clarity", description: "Choose your dates and check availability. Review the total price and cancellation terms before requesting." },
              { image: newOwnerPhotos[1].src, title: "Stay connected", description: "Message your host, follow your reservation, and keep your trip details together in your account." },
            ].map(({ image, title, description }) => (
              <article key={title}><img src={image} alt={title} loading="lazy" /><h3>{title}</h3><p>{description}</p></article>
            ))}
          </div>
          <Link to="/help">See how booking works <ArrowUpRight size={18} /></Link>
        </section>
        <div className="r-category-nav" aria-label="Stay categories">
          {rentalCategories.map((c, i) => {
            const Icon = icons[i]
            return (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => {
                  setCategory(c)
                  navigate(`/search?category=${encodeURIComponent(c)}`)
                }}
              >
                <Icon size={22} />
                <span>{c}</span>
              </button>
            )
          })}
          <Link className="r-filter-shortcut" to="/search">
            <SlidersHorizontal size={17} />
            Filters
          </Link>
        </div>
        {query.error && (
          <ErrorBox message={query.error} retry={query.refresh} />
        )}{" "}
        {query.loading && !items.length ? (
          <Skeletons />
        ) : (
          <>
            {more.error && <ErrorBox message={more.error} retry={more.refresh} />}
            <HomeFlatCatalogue items={all} loading={query.loading || more.loading} />
            <div className="r-escape-banner">
              <img
                src={newOwnerPhotos[3].src}
                alt={newOwnerPhotos[3].alt}
                loading="lazy"
              />
              <div>
                <span>THE BEST PLANS START WITH A PLACE</span>
                <h2>
                  A little less routine.
                  <br />A little more somewhere new.
                </h2>
                <p>
                  From Delhi city stays to a weekend in NCR, find a space
                  <br className="r-desktop" /> that feels like your kind of
                  escape.
                </p>
                <Link className="r-white-button" to="/search">
                  Find my next stay <ArrowUpRight size={17} />
                </Link>
              </div>
            </div>
            <Section
              title="A beautiful stay. A little less spend."
              subtitle="Thoughtful places for everyday budgets."
              items={all.filter((p) => p.nightlyRate <= 350000)}
              query="maxPrice=3500"
            />
            <Section
              title="A little extra room to unwind"
              subtitle="Villas, pools, and space for the whole group."
              items={all.filter((p) => p.type === "Villa")}
              query="type=Villa"
            />
          </>
        )}
        <HomePhotoGallery />
        <div className="r-host-banner">
          <div>
            <span className="r-kicker">GOOD SPACES ARE MEANT TO BE SHARED</span>
            <h2>Your place. Their next great memory.</h2>
            <p>
              Bring your home to Omshivraj and welcome a world of possibilities.
            </p>
            <Link to="/host" className="r-dark-button">
              Become a host <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="r-host-art">
            <img
              src={newOwnerPhotos[6].src}
              alt={newOwnerPhotos[6].alt}
              loading="lazy"
            />
            <span>
              <Home size={18} />
              Make room for possibility.
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string
  retry?: () => void
}) {
  return (
    <div className="r-error-box" role="alert">
      <b>Something needs a moment.</b>
      <p>{message}</p>
      {retry && (
        <button className="r-secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  )
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="r-empty">
      <span>
        <Home size={35} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  )
}
function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState(false),
    [map, setMap] = useState(false)
  const query = useRentalResource<{
    items: RentalProperty[]
    total: number
    page: number
    pageSize: number
  }>(`/search?${params}`)
  const { session } = useRental()
  const [draft, setDraft] = useState<Record<string, string>>({})
  function edit(k: string, v: string) {
    setDraft((prev) => ({ ...prev, [k]: v }))
  }
  function open() {
    setDraft(Object.fromEntries(params))
    setFilter(true)
  }
  function apply() {
    const p = new URLSearchParams(params)
    for (const k of [
      "minPrice",
      "maxPrice",
      "type",
      "bedrooms",
      "beds",
      "bathrooms",
      "amenities",
      "rating",
      "instantBook",
      "flexible",
    ]) {
      if (draft[k]) p.set(k, draft[k])
      else p.delete(k)
    }
    p.delete("page")
    setParams(p)
    setFilter(false)
  }
  const items = query.data?.items || []
  return (
    <div className="r-container r-search-page">
      <div className="r-results-head">
        <div>
          <span className="r-kicker">FIND YOUR KIND OF STAY</span>
          <h1>
            {params.get("destination")
              ? `Stays in ${params.get("destination")}`
              : "A place for every kind of escape"}
          </h1>
          <p>
            {query.loading
              ? "Finding your next getaway…"
              : `${query.data?.total || 0} stays`}
            {params.get("checkIn")
              ? ` · ${rentalDate(params.get("checkIn")!)} – ${rentalDate(params.get("checkOut")!)}`
              : " · Add dates for availability and full prices"}
          </p>
        </div>
        <div className="r-results-actions">
          <button className="r-secondary" onClick={open}>
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <select
            aria-label="Sort stays"
            value={params.get("sort") || "recommended"}
            onChange={(e) => {
              const p = new URLSearchParams(params)
              p.set("sort", e.target.value)
              p.delete("page")
              setParams(p)
            }}
          >
            <option value="recommended">Recommended</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Highest rated</option>
          </select>
        </div>
      </div>
      <div className="r-active-filters">
        {[
          "category",
          "type",
          "amenities",
          "minPrice",
          "maxPrice",
          "rating",
          "flexible",
          "instantBook",
        ]
          .filter((k) => params.has(k))
          .map((k) => (
            <button
              key={k}
              onClick={() => {
                const p = new URLSearchParams(params)
                p.delete(k)
                p.delete("page")
                setParams(p)
              }}
            >
              {k === "minPrice"
                ? "From ₹"
                : k === "maxPrice"
                  ? "Up to ₹"
                  : k === "rating"
                    ? "Rating "
                    : ""}
              {params.get(k) === "true" ? k : params.get(k)}
              <X size={13} />
            </button>
          ))}
        {params.size > 0 && (
          <button onClick={() => setParams({})}>Clear all</button>
        )}
      </div>
      {query.error ? (
        <ErrorBox message={query.error} retry={query.refresh} />
      ) : query.loading ? (
        <Skeletons />
      ) : !items.length ? (
        <Empty
          title="A different search might be the one."
          body="Try another destination, remove a filter, or explore flexible dates."
          action={
            <button className="r-primary" onClick={() => setParams({})}>
              Explore all stays
            </button>
          }
        />
      ) : (
        <div className={map ? "r-map-layout" : ""}>
          <div className="r-card-grid">
            {items.map((p) => (
              <RentalCard key={p.id} property={p} />
            ))}
          </div>
          {map && (
            <div className="r-map-panel">
              <h2>Explore the neighbourhood</h2>
              {session?.mapsToken && items.some(hasPropertyCoordinates) ? (
                <iframe
                  title="Map of matching stays"
                  src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12.html?access_token=${encodeURIComponent(session.mapsToken)}#9/${items.find(hasPropertyCoordinates)!.latitude}/${items.find(hasPropertyCoordinates)!.longitude}`}
                />
              ) : (
                <>
                  <p className="r-muted">
                    Explore the location of each stay. Where a property location
                    has not been supplied, the link opens its city map.
                  </p>
                  {items.slice(0, 12).map((p) => (
                    <a
                      key={p.id}
                      target="_blank"
                      rel="noreferrer"
                      href={propertyMapUrl(p)}
                    >
                      <MapPin size={17} />
                      <span>
                        {p.city}
                        <b>{money(p.nightlyRate)} / night</b>
                      </span>
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {query.data && query.data.total > 24 && (
        <div className="r-pagination">
          <button
            disabled={Number(params.get("page") || 1) <= 1}
            className="r-secondary"
            onClick={() => {
              const p = new URLSearchParams(params)
              p.set("page", String(Number(p.get("page") || 1) - 1))
              setParams(p)
            }}
          >
            Previous
          </button>
          <span>
            Page {query.data.page} of {Math.ceil(query.data.total / 24)}
          </span>
          <button
            disabled={query.data.page * 24 >= query.data.total}
            className="r-secondary"
            onClick={() => {
              const p = new URLSearchParams(params)
              p.set("page", String(Number(p.get("page") || 1) + 1))
              setParams(p)
            }}
          >
            Next
          </button>
        </div>
      )}
      <button className="r-map-toggle" onClick={() => setMap(!map)}>
        {map ? "Show list" : "Show map"}
        <MapIcon size={17} />
      </button>
      {filter && (
        <RentalDialog
          title="Make it your kind of stay"
          close={() => setFilter(false)}
        >
          <h3>Price range</h3>
          <p className="r-muted r-small">
            Nightly price in INR, before fees and taxes
          </p>
          <div className="r-date-fields">
            <label className="r-input-label">
              Minimum
              <input
                type="number"
                min="0"
                placeholder="₹ 0"
                value={draft.minPrice || ""}
                onChange={(e) => edit("minPrice", e.target.value)}
              />
            </label>
            <label className="r-input-label">
              Maximum
              <input
                type="number"
                min="0"
                placeholder="Any price"
                value={draft.maxPrice || ""}
                onChange={(e) => edit("maxPrice", e.target.value)}
              />
            </label>
          </div>
          <h3>Property type</h3>
          <div className="r-choice-chips">
            {[
              "",
              "Apartment",
              "Villa",
              "Cottage",
              "Cabin",
              "Homestay",
              "House",
            ].map((t) => (
              <button
                className={(draft.type || "") === t ? "active" : ""}
                key={t}
                onClick={() => edit("type", t)}
              >
                {t || "Any type"}
              </button>
            ))}
          </div>
          <div className="r-date-fields">
            {["bedrooms", "beds", "bathrooms"].map((k) => (
              <label className="r-input-label" key={k}>
                {k}
                <select
                  value={draft[k] || ""}
                  onChange={(e) => edit(k, e.target.value)}
                >
                  <option value="">Any</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option value={n} key={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <h3>The little essentials</h3>
          <div className="r-amenity-checks">
            {rentalAmenities.map((a) => (
              <label key={a}>
                <input
                  type="checkbox"
                  checked={(draft.amenities || "").split(",").includes(a)}
                  onChange={(e) => {
                    const set = new Set(
                      (draft.amenities || "").split(",").filter(Boolean)
                    )
                    if (e.target.checked) set.add(a)
                    else set.delete(a)
                    edit("amenities", [...set].join(","))
                  }}
                />
                {a}
              </label>
            ))}
          </div>
          <label className="r-check-row">
            <input
              type="checkbox"
              checked={draft.flexible === "true"}
              onChange={(e) => edit("flexible", e.target.checked ? "true" : "")}
            />
            Flexible cancellation
          </label>
          <label className="r-check-row">
            <input
              type="checkbox"
              checked={draft.instantBook === "true"}
              onChange={(e) =>
                edit("instantBook", e.target.checked ? "true" : "")
              }
            />
            Instant booking with verified online payment
          </label>
          <label className="r-input-label">
            Minimum guest rating
            <select
              value={draft.rating || ""}
              onChange={(e) => edit("rating", e.target.value)}
            >
              <option value="">Any rating</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
              <option value="4.8">4.8+</option>
            </select>
          </label>
          <div className="r-modal-actions">
            <button className="r-text-button" onClick={() => setDraft({})}>
              Clear filters
            </button>
            <button className="r-dark-button" onClick={apply}>
              Show matching stays
            </button>
          </div>
        </RentalDialog>
      )}
    </div>
  )
}

function identityBookingDraft(slug: string) {
  const empty = { checkIn: "", checkOut: "", guests: 1, coupon: "" }
  if (
    typeof window === "undefined" ||
    (!new URLSearchParams(window.location.search).has("digilocker") &&
      new URLSearchParams(window.location.search).get("booking") !== "resume")
  )
    return empty
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`omshivraj-digilocker:${slug}`) || "null"
    )
    if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt < Date.now()) return empty
    return {
      checkIn: typeof value.checkIn === "string" ? value.checkIn : "",
      checkOut: typeof value.checkOut === "string" ? value.checkOut : "",
      guests:
        Number.isInteger(value.guests) && value.guests > 0 && value.guests <= 30
          ? value.guests
          : 1,
      coupon: typeof value.coupon === "string" ? value.coupon : "",
    }
  } catch {
    return empty
  }
}
function StayPage() {
  const slug = useLocation().pathname.split("/")[2],
    navigate = useNavigate(),
    { session, notify, saved, toggleSaved } = useRental()
  const { content } = useContent()
  const query = useRentalResource<
    RentalProperty & {
      reviews: {
        id: string
        rating: number
        body: string
        name: string
        response: string
        createdAt: string
      }[]
      blocked: { start: string; end: string }[]
    }
  >(`/properties/${slug}`)
  const p = query.data || content.rentals?.find((x) => x.slug === slug)
  const [draft] = useState(() => identityBookingDraft(slug))
  const [identityConsent, setIdentityConsent] = useState(false)
  const identityNeeded = Boolean(
    session?.digilockerRequired && !session.user?.digilockerVerified
  )
  const identityResult = new URLSearchParams(useLocation().search).get(
    "digilocker"
  )
  const identityNotice = (
    {
      failed: "DigiLocker verification failed. Please try again.",
      expired: "Your verification session expired. Please start again.",
      cancelled: "Verification was cancelled. You can try again when ready.",
      "not-linked": "Please link your Aadhaar in DigiLocker, then try again.",
      unavailable: "DigiLocker setup is not complete. Please contact support.",
    } as Record<string, string>
  )[identityResult || ""]
  const [gallery, setGallery] = useState<number | null>(null),
    [checkIn, setCheckIn] = useState(draft.checkIn),
    [checkOut, setCheckOut] = useState(draft.checkOut),
    [guests, setGuests] = useState(draft.guests),
    [coupon, setCoupon] = useState(draft.coupon),
    [quote, setQuote] = useState<Record<string, number> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(false),
    [messageBody, setMessageBody] = useState(""),
    [report, setReport] = useState(false),
    [reportBody, setReportBody] = useState("")
  const bookingKey = useRef("")
  const [dateField, setDateField] = useState<"checkIn" | "checkOut">("checkIn")
  const blockedDates = query.data?.blocked || []
  function chooseArrival(date: string) {
    clearQuote()
    if (date && (date < today() || unavailableNight(date, blockedDates))) {
      setError("This check-in date is unavailable. Choose another date.")
      return
    }
    setCheckIn(date)
    if (!date || !availableStay(date, checkOut, blockedDates)) setCheckOut("")
    setDateField(date ? "checkOut" : "checkIn")
  }
  function chooseDeparture(date: string) {
    clearQuote()
    if (date && !availableStay(checkIn, date, blockedDates)) {
      setError("Choose checkout after check-in, within 90 nights, without unavailable nights.")
      return
    }
    setCheckOut(date)
  }
  async function verifyIdentity() {
    setBusy(true)
    setError("")
    try {
      const response = await rentalRequest<{ url: string }>(
        "/digilocker/start",
        { consent: identityConsent, returnTo: `/stays/${slug}` }
      )
      saveBookingDraft()
      window.location.assign(response.url)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  function saveBookingDraft() {
    try {
      sessionStorage.setItem(`omshivraj-digilocker:${slug}`, JSON.stringify({
        checkIn, checkOut, guests, coupon, expiresAt: Date.now() + 15 * 60000,
      }))
    } catch {
      /* Continue even when the browser disables session storage. */
    }
  }
  function clearQuote() {
    setQuote(null)
    setError("")
    bookingKey.current = ""
  }
  async function price() {
    if (!p) return
    if (!availableStay(checkIn, checkOut, blockedDates) || checkIn < today()) {
      setError("Choose available check-in and checkout dates for a stay of 1–90 nights.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const q = await rentalRequest<Record<string, number>>(
        `/properties/${p.id}/quote`,
        { checkIn, checkOut, guests, coupon }
      )
      setQuote(q)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function reserve() {
    if (!p) return
    if (!session?.user) {
      saveBookingDraft()
      navigate(`/login?next=${encodeURIComponent(`/stays/${slug}?booking=resume`)}`)
      return
    }
    if (!quote) {
      await price()
      return
    }
    if (identityNeeded) {
      setError("Complete DigiLocker verification before requesting this stay.")
      return
    }
    if (p.bookingMode === "PAYMENT" && !session?.paymentsConfigured) {
      setError(
        "Online payment is currently unavailable. Please contact support before booking."
      )
      return
    }
    setBusy(true)
    setError("")
    try {
      bookingKey.current ||= crypto.randomUUID()
      const booking = await rentalRequest<RentalBooking>("/bookings", {
        propertyId: p.id,
        checkIn,
        checkOut,
        guests,
        coupon,
        idempotencyKey: bookingKey.current,
      })
      try {
        sessionStorage.removeItem(`omshivraj-digilocker:${slug}`)
      } catch {
        /* The saved draft expires independently. */
      }
      notify(
        `Request ${booking.reference} saved. ${p.bookingMode === "HOST_APPROVAL" ? "Awaiting host approval." : "Complete payment to confirm."}`
      )
      if (p.bookingMode === "PAYMENT") {
        await rentalCheckout(booking, () => {}, notify)
      }
      navigate("/trips")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (query.error)
    return (
      <div className="r-container">
        <ErrorBox message={query.error} retry={query.refresh} />
      </div>
    )
  if (!p)
    return (
      <div className="r-container">
        <Skeletons />
      </div>
    )
  return (
    <div className="r-container r-detail r-detail-refined">
      <div className="r-detail-breadcrumb">
        <Link to="/search">Stays</Link>
        <ChevronRight size={13} />
        <Link to={`/search?destination=${p.city}`}>{p.city}</Link>
        <ChevronRight size={13} />
        <span>{p.type}</span>
      </div>
      <div className="r-detail-title">
        <div>
          <h1>{p.title}</h1>
          <p>
            <MapPin size={15} />
            {p.city}, India · {p.demo ? "Demonstration property" : p.type}
          </p>
        </div>
        <div>
          <button
            className="r-text-button"
            onClick={async () => {
              const url = window.location.href
              try {
                if (navigator.share)
                  await navigator.share({ title: p.title, url })
                else {
                  await navigator.clipboard.writeText(url)
                  notify("Stay link copied.")
                }
              } catch {
                notify("Copy the page URL to share this stay.")
              }
            }}
          >
            <Share2 size={16} />
            Share
          </button>
          <button className="r-text-button" onClick={() => toggleSaved(p)}>
            <Heart size={16} fill={saved.has(p.id) ? "currentColor" : "none"} />
            Save
          </button>
        </div>
      </div>
      <div className="r-property-gallery">
        {p.images.slice(0, 5).map((src, i) => (
          <button
            key={i}
            onClick={() => setGallery(i)}
            aria-label={`Open property photo ${i + 1}`}
          >
            <img src={src} alt={`${p.title}, photo ${i + 1}`} />
          </button>
        ))}
        <button className="r-gallery-button" onClick={() => setGallery(0)}>
          <Grid2X2 size={15} />
          Show all photos
        </button>
      </div>
      <nav className="r-stay-navigation" aria-label="Stay details">
        <a href="#stay-overview">Overview</a>
        <a href="#stay-amenities">Amenities</a>
        <a href="#stay-dates">Availability</a>
        <a href="#stay-location">Location</a>
        <a href="#stay-reviews">Reviews</a>
        <a className="r-stay-book-link" href="#stay-booking">
          Choose dates <ArrowUpRight size={15} />
        </a>
      </nav>
      <div className="r-detail-columns">
        <div className="r-detail-content">
          <section id="stay-overview" className="r-stay-overview">
            <span className="r-stay-eyebrow">
              YOUR OWN CORNER OF {p.city.toUpperCase()}
            </span>
            <h2>
              Entire {p.type.toLowerCase()} in {p.city}, India
            </h2>
            <div className="r-stay-stats">
              <span>
                <Users size={20} aria-hidden="true" />
                <b>{p.capacity}</b>
                <small>guests</small>
              </span>
              <span>
                <Home size={20} aria-hidden="true" />
                <b>{p.bedrooms}</b>
                <small>bedroom{p.bedrooms !== 1 ? "s" : ""}</small>
              </span>
              <span>
                <BedDouble size={20} aria-hidden="true" />
                <b>{p.beds}</b>
                <small>bed{p.beds !== 1 ? "s" : ""}</small>
              </span>
              <span>
                <Bath size={20} aria-hidden="true" />
                <b>{p.bathrooms}</b>
                <small>bathroom{p.bathrooms !== 1 ? "s" : ""}</small>
              </span>
            </div>
            <div className="r-review-summary">
              <Star size={20} />
              {p.reviewCount ? (
                <>
                  <b>{Number(p.rating).toFixed(2)}</b>
                  <span>{p.reviewCount} reviews from eligible stays</span>
                </>
              ) : (
                <>
                  <b>Be part of a new story.</b>
                  <span>No guest reviews yet.</span>
                </>
              )}
            </div>
          </section>
          <section className="r-host-line">
            <span className="r-person-avatar">
              {p.hostName?.charAt(0) || "H"}
            </span>
            <div>
              <h3>Hosted by {p.demo ? "a demonstration host" : p.hostName}</h3>
              <p>
                {p.demo
                  ? "Illustrative host profile · Not a verified real rental"
                  : "Host on Omshivraj"}
              </p>
            </div>
          </section>
          <section className="r-property-highlights">
            <div>
              <Home />
              <span>
                <b>A space all to yourself</b>
                <small>Settle in and make yourself at home.</small>
              </span>
            </div>
            <div>
              <CalendarDays />
              <span>
                <b>
                  {p.cancellation === "FLEXIBLE"
                    ? "Flexible cancellation"
                    : "Clear cancellation terms"}
                </b>
                <small>Review the policy before you request your stay.</small>
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                <b>
                  {p.bookingMode === "HOST_APPROVAL"
                    ? "Request, then relax"
                    : "Secure online checkout"}
                </b>
                <small>
                  {p.bookingMode === "HOST_APPROVAL"
                    ? "Your host confirms availability. Payment is due at the property."
                    : "Your reservation is confirmed after payment verification."}
                </small>
              </span>
            </div>
          </section>
          <section className="r-stay-description">
            <span className="r-stay-eyebrow">ABOUT THE SPACE</span>
            <h2>A place to slow down</h2>
            {p.description
              .split("\n")
              .filter((line) => line.trim())
              .map((line, i) => (
                <p
                  className={
                    /demonstration|illustrative/i.test(line)
                      ? "r-stay-disclosure"
                      : undefined
                  }
                  key={i}
                >
                  {line.replace(
                    "licensed stock photography",
                    "illustrative photography"
                  )}
                </p>
              ))}
          </section>
          <section id="stay-amenities">
            <div className="r-stay-section-label">
              <span className="r-stay-eyebrow">THE EVERYDAY COMFORTS</span>
              <span>{p.amenities.length} amenities</span>
            </div>
            <h2>What this place offers</h2>
            <div className="r-amenity-list">
              {p.amenities.map((a) => {
                const Icon =
                  a === "Wi-Fi"
                    ? Wifi
                    : a === "Kitchen"
                      ? CookingPot
                      : a === "Parking"
                        ? Car
                        : a === "Air conditioning"
                          ? Wind
                          : a === "Pets allowed"
                            ? PawPrint
                            : Home
                return (
                  <span key={a}>
                    <Icon size={22} />
                    {a}
                  </span>
                )
              })}
            </div>
          </section>
          <section id="stay-dates" className="r-stay-dates">
            <span className="r-stay-eyebrow">PLAN YOUR TIME AWAY</span>
            <h2>Make time for a getaway</h2>
            <div className="r-stay-date-summary">
              <CalendarDays size={20} aria-hidden="true" />
              <div>
                <b>
                  {checkIn ? rentalDate(checkIn) : "Choose your arrival"}
                  {checkOut ? ` — ${rentalDate(checkOut)}` : ""}
                </b>
                <span>
                  {checkIn
                    ? "Your selected dates · confirm availability below"
                    : "Select a day to start planning your stay"}
                </span>
              </div>
            </div>
            <RentalCalendar
              selected={checkIn}
              checkout={checkOut}
              choosing={dateField}
              chooseField={setDateField}
              blocked={blockedDates}
              choose={(d) => {
                if (dateField === "checkIn") chooseArrival(d)
                else chooseDeparture(d)
              }}
            />
            <p>
              Select your dates to check live availability and see a full price
              breakdown.
            </p>
            {query.data?.blocked?.length ? (
              <details>
                <summary>Unavailable dates</summary>
                {query.data.blocked.map((b, i) => (
                  <p key={i}>
                    {rentalDate(b.start)} — {rentalDate(b.end)}
                  </p>
                ))}
              </details>
            ) : (
              <p className="r-muted">
                No blocked dates are currently listed. Availability is checked
                when you request.
              </p>
            )}
          </section>
        </div>
        <aside
          className="r-booking-side"
          id="stay-booking"
          aria-label="Book this stay"
        >
          <div className="r-booking-box">
            <span className="r-stay-eyebrow">MAKE YOURSELF AT HOME</span>
            <div className="r-booking-price">
              <b>{money(p.nightlyRate)}</b>
              <span>night</span>
            </div>
            <p className="r-booking-subtitle">
              Entire {p.type.toLowerCase()} · {p.city}
            </p>
            <div className="r-booking-inputs">
              <label>
                CHECK-IN
                <input
                  aria-label="Booking check-in"
                  type="date"
                  min={today()}
                  value={checkIn}
                  onInput={(e) => chooseArrival(e.currentTarget.value)}
                  onChange={(e) => chooseArrival(e.target.value)}
                />
              </label>
              <label>
                CHECKOUT
                <input
                  aria-label="Booking checkout"
                  type="date"
                  min={checkIn ? nextDate(checkIn) : nextDate(today())}
                  max={checkIn ? nextDate(checkIn, 90) : undefined}
                  disabled={!checkIn}
                  value={checkOut}
                  onInput={(e) => chooseDeparture(e.currentTarget.value)}
                  onChange={(e) => chooseDeparture(e.target.value)}
                />
              </label>
              <label className="r-booking-guests">
                GUESTS
                <select
                  aria-label="Booking guests"
                  value={guests}
                  onChange={(e) => {
                    setGuests(Number(e.target.value))
                    clearQuote()
                  }}
                >
                  {Array.from({ length: p.capacity }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} guest{i ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <a className="r-available-dates-link" href="#stay-dates" onClick={() => setDateField(checkIn && !checkOut ? "checkOut" : "checkIn")}>
              <CalendarDays size={16} aria-hidden="true" /> View available dates
            </a>
            <details className="r-promo">
              <summary>Have a promotion code?</summary>
              <input
                aria-label="Promotion code"
                placeholder="Promotion code"
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value.toUpperCase())
                  clearQuote()
                }}
              />
            </details>
            <section
              className="r-payment-options"
              aria-labelledby="stay-payment-heading"
            >
              <h3 id="stay-payment-heading">Payment method</h3>
              <div
                className={`r-payment-method ${p.bookingMode === "HOST_APPROVAL" ? "is-selected" : "is-unavailable"}`}
              >
                <Building2 size={21} aria-hidden="true" />
                <div>
                  <b>Pay at the property</b>
                  <p>
                    {p.bookingMode === "HOST_APPROVAL"
                      ? "Request your stay now. Pay at the property after host confirmation."
                      : "This flat requires online payment to confirm."}
                  </p>
                </div>
                {p.bookingMode === "HOST_APPROVAL" && (
                  <span className="r-payment-badge">Selected</span>
                )}
              </div>
              <div
                className={`r-payment-method ${p.bookingMode === "PAYMENT" && session?.paymentsConfigured ? "is-selected" : "is-unavailable"}`}
              >
                <CreditCard size={21} aria-hidden="true" />
                <div>
                  <b>Secure online payment</b>
                  <p>
                    {!session
                      ? "Checking online payment availability…"
                      : !session.paymentsConfigured
                        ? "Online payments are not available yet."
                        : p.bookingMode === "PAYMENT"
                          ? "Pay through Razorpay. Available methods are shown at checkout."
                          : "Online payment is not offered for this flat."}
                  </p>
                </div>
                <span className="r-payment-badge">
                  {p.bookingMode === "PAYMENT" && session?.paymentsConfigured
                    ? "Selected"
                    : "Unavailable"}
                </span>
              </div>
              <a className="r-payment-help" href={rentalContact.callUrl}>
                Questions about payment? Call us{" "}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </section>
            {(session?.digilockerRequired || session?.digilockerConfigured) && (
              <section
                className="r-digilocker-panel"
                aria-label="DigiLocker verification"
              >
                <div>
                  <ShieldCheck size={20} />
                  <b>
                    {session?.user?.digilockerVerified
                      ? "DigiLocker account verified"
                      : "Verify with DigiLocker"}
                  </b>
                </div>
                {session?.user?.digilockerVerified ? (
                  <p>
                    Your account verification is complete. Choose your dates to
                    request a stay.
                  </p>
                ) : (
                  <>
                    <p>
                      {session?.digilockerRequired
                        ? "Account verification is required before requesting a stay."
                        : "Verify your account securely with DigiLocker."}
                    </p>
                    {!session?.user ? (
                      <Link
                        to={`/login?next=${encodeURIComponent(`/stays/${slug}`)}`}
                      >
                        Log in to verify your account
                      </Link>
                    ) : !session.digilockerConfigured ? (
                      <p role="status">
                        DigiLocker setup is in progress. Please contact support
                        before booking.
                      </p>
                    ) : (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={identityConsent}
                            onChange={(e) =>
                              setIdentityConsent(e.target.checked)
                            }
                          />{" "}
                          <span>
                            I agree to share my DigiLocker account details for
                            this verification.
                          </span>
                        </label>
                        <p className="r-digilocker-disclosure">
                          DigiLocker returns your name, date of birth, gender
                          and Aadhaar-linkage status. We keep only verification
                          status, time and an account reference digest. No
                          documents are downloaded.{" "}
                          <Link to="/privacy">Privacy policy</Link>
                        </p>
                        <button
                          type="button"
                          className="r-secondary r-full"
                          disabled={busy || !identityConsent}
                          onClick={verifyIdentity}
                        >
                          {busy ? "Connecting…" : "Continue to DigiLocker"}
                          <ArrowUpRight size={16} />
                        </button>
                      </>
                    )}
                  </>
                )}
                {identityNotice && <p role="alert">{identityNotice}</p>}
              </section>
            )}
            {error && (
              <p role="alert" className="r-error">
                {error}
              </p>
            )}
            <button
              className="r-primary r-full"
              disabled={
                busy ||
                !checkIn ||
                !checkOut ||
                Boolean(quote && identityNeeded && session?.user) ||
                Boolean(
                  quote &&
                  p.bookingMode === "PAYMENT" &&
                  !session?.paymentsConfigured
                )
              }
              onClick={quote ? reserve : price}
            >
              {busy
                ? "Checking…"
                : quote
                  ? p.bookingMode === "HOST_APPROVAL"
                    ? "Request to book"
                    : "Continue to payment"
                  : "Check availability"}
            </button>
            <p className="r-booking-note">
              {quote
                ? "You won’t be charged yet."
                : "Select dates for the total price."}
            </p>
            {quote && (
              <div className="r-price-breakdown">
                <p>
                  <span>
                    {money(p.nightlyRate)} × {quote.nights} nights
                  </span>
                  <span>{money(quote.nightlySubtotal)}</span>
                </p>
                <p>
                  <span>Cleaning fee</span>
                  <span>{money(quote.cleaningFee)}</span>
                </p>
                <p>
                  <span>Omshivraj service fee</span>
                  <span>{money(quote.platformFee)}</span>
                </p>
                <p>
                  <span>Configured taxes</span>
                  <span>{money(quote.tax)}</span>
                </p>
                {quote.discount > 0 && (
                  <p>
                    <span>Promotion discount</span>
                    <span>−{money(quote.discount)}</span>
                  </p>
                )}
                <p className="r-price-total">
                  <b>Total · INR</b>
                  <b>{money(quote.total)}</b>
                </p>
              </div>
            )}
            <div className="r-booking-reassurance">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                {p.bookingMode === "HOST_APPROVAL"
                  ? "Host confirmation first. Payment at the property."
                  : "Your final price is calculated before checkout."}
              </span>
            </div>
          </div>
          <button
            className="r-text-button r-contact-host"
            onClick={() => {
              if (!session?.user) {
                navigate(`/login?next=/stays/${slug}`)
                return
              }
              setMessage(true)
            }}
          >
            <MessageCircle size={16} />
            Contact the host
          </button>
        </aside>
      </div>
      <div className="r-mobile-booking" aria-label="Stay booking shortcut">
        <div>
          <b>{money(p.nightlyRate)}</b>
          <span> / night</span>
          <small>
            {checkIn
              ? `${rentalDate(checkIn)}${checkOut ? ` — ${rentalDate(checkOut)}` : ""}`
              : "Add dates for the total price"}
          </small>
        </div>
        <a href="#stay-booking">
          {quote ? "Review booking" : "Choose dates"}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <section className="r-detail-lower" id="stay-location">
        <span className="r-stay-eyebrow">GET TO KNOW THE NEIGHBOURHOOD</span>
        <h2>Where you’ll be</h2>
        <p>
          {p.city}, India.{" "}
          {p.demo
            ? "Approximate demonstration location."
            : "The full address is shared after reservation confirmation."}
        </p>
        <a
          className="r-location-preview"
          href={propertyMapUrl(p)}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin />
          <div>
            <b>Explore {p.city}</b>
            <span>{hasPropertyCoordinates(p) ? "Open neighbourhood map" : "Open city map"}</span>
          </div>
          <ArrowUpRight />
        </a>
      </section>
      <section className="r-detail-lower" id="stay-reviews">
        <span className="r-stay-eyebrow">
          WORDS FROM YOUR FELLOW TRAVELLERS
        </span>
        <h2>
          {p.reviewCount
            ? `${p.reviewCount} guest reviews`
            : "Every great stay starts with a first guest."}
        </h2>
        {!p.reviewCount ? (
          <p className="r-muted">
            No reviews yet. Only guests who have completed an eligible stay can
            leave a review.
          </p>
        ) : (
          <div className="r-review-grid">
            {query.data?.reviews?.map((r) => (
              <article key={r.id}>
                <b>{r.name}</b>
                <p>
                  <Star size={12} fill="currentColor" />
                  {r.rating} · {rentalDate(r.createdAt)}
                </p>
                <p>{r.body}</p>
                {r.response && <blockquote>{r.response}</blockquote>}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="r-detail-lower">
        <h2>Good to know before you go</h2>
        <div className="r-rules">
          <div>
            <h3>House rules</h3>
            <p>Check-in: after {p.checkInTime}</p>
            <p>Checkout: before {p.checkOutTime}</p>
            <p>Maximum {p.capacity} guests</p>
            <p>
              {p.amenities.includes("Pets allowed")
                ? "Pets welcome"
                : "No pets"}
            </p>
            <p>{p.houseRules}</p>
          </div>
          <div>
            <h3>Cancellation policy</h3>
            <p>
              {p.cancellation === "FLEXIBLE"
                ? "Full refund until 24 hours before check-in; 50% thereafter until check-in."
                : p.cancellation === "MODERATE"
                  ? "Full refund until 5 days before check-in; 50% thereafter until check-in."
                  : "50% refund until 7 days before check-in; no refund thereafter."}
            </p>
            <Link className="r-text-button" to="/cancellation-policy">
              Read the policy <ChevronRight size={14} />
            </Link>
          </div>
          <div>
            <h3>Your peace of mind</h3>
            <p>
              Keep payments and messages on Omshivraj. Report concerns to our
              platform administrators.
            </p>
            <button
              className="r-text-button"
              onClick={async () => {
                if (!session?.user) {
                  navigate("/login")
                  return
                }
                setReport(true)
              }}
            >
              Report this listing
            </button>
          </div>
        </div>
      </section>
      <Similar property={p} />
      {report && (
        <RentalDialog
          title="Report this listing"
          close={() => setReport(false)}
        >
          <label className="r-input-label">
            Describe your concern
            <textarea
              value={reportBody}
              onChange={(e) => setReportBody(e.target.value)}
              maxLength={3000}
            />
          </label>
          <button
            className="r-primary"
            disabled={!reportBody.trim()}
            onClick={async () => {
              try {
                await rentalRequest("/reports", {
                  targetId: p.id,
                  body: reportBody,
                })
                setReport(false)
                notify("Your report was saved for review.")
              } catch (e) {
                notify((e as Error).message)
              }
            }}
          >
            Submit report
          </button>
        </RentalDialog>
      )}
      {gallery !== null && (
        <RentalDialog
          title={`${p.title} · ${gallery + 1} / ${p.images.length}`}
          close={() => setGallery(null)}
        >
          <img
            className="r-lightbox"
            src={p.images[gallery]}
            alt={`${p.title} photo ${gallery + 1}`}
          />
          <div className="r-modal-actions">
            <button
              className="r-secondary"
              onClick={() =>
                setGallery((gallery + p.images.length - 1) % p.images.length)
              }
            >
              <ChevronLeft />
              Previous
            </button>
            <button
              className="r-secondary"
              onClick={() => setGallery((gallery + 1) % p.images.length)}
            >
              Next
              <ChevronRight />
            </button>
          </div>
        </RentalDialog>
      )}
      {message && (
        <RentalDialog
          title="A conversation starts here"
          close={() => setMessage(false)}
        >
          <p>
            Ask the host about {p.title}. Keep personal payment information out
            of messages.
          </p>
          <label className="r-input-label">
            Your message
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={4}
            />
          </label>
          <button
            className="r-primary"
            disabled={!messageBody.trim()}
            onClick={async () => {
              try {
                await rentalRequest("/conversations", {
                  propertyId: p.id,
                  body: messageBody,
                })
                setMessage(false)
                navigate("/messages")
              } catch (e) {
                notify((e as Error).message)
              }
            }}
          >
            Send message
          </button>
        </RentalDialog>
      )}
    </div>
  )
}
function Similar({ property }: { property: RentalProperty }) {
  const query = useRentalResource<{ items: RentalProperty[] }>(
    `/search?destination=${property.city}`
  )
  return (
    <Section
      title="More places you might love"
      items={(query.data?.items || []).filter((p) => p.id !== property.id)}
      query={`destination=${property.city}`}
    />
  )
}
function Footer() {
  const [tab, setTab] = useState("Popular")
  const groups = {
    Popular: ["Delhi", "Gurugram", "Noida", "Ghaziabad"],
    Delhi: ["Delhi"],
    "Noida & Greater Noida": ["Noida", "Greater Noida"],
    "More NCR": ["Gurugram", "Ghaziabad", "Faridabad"],
  }
  return (
    <footer className="r-footer r-footer-refined">
      <div className="r-container">
        <div className="r-inspiration">
          <div className="r-footer-intro">
            <div>
              <span className="r-footer-eyebrow">A LITTLE INSPIRATION</span>
              <h2>Somewhere new. Something you.</h2>
              <p>Discover your next favourite place in Delhi & Delhi NCR.</p>
            </div>
            <Link className="r-footer-explore" to="/search">
              Explore stays <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div
            className="r-inspiration-tabs"
            role="group"
            aria-label="Explore destinations by category"
          >
            {Object.keys(groups).map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="r-inspiration-links">
            {groups[tab as keyof typeof groups].flatMap((city) =>
              ["Apartment", "Villa"].map((type) => (
                <Link
                  key={`${city}-${type}`}
                  to={`/search?destination=${city}&type=${type}`}
                >
                  <span className="r-footer-place-icon" aria-hidden="true">
                    {type === "Villa" ? (
                      <Home size={18} />
                    ) : (
                      <Building2 size={18} />
                    )}
                  </span>
                  <span className="r-footer-place-copy">
                    <b>{city}</b>
                    <span>{type} stays</span>
                  </span>
                  <ChevronRight
                    className="r-footer-place-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="r-footer-columns">
          <div className="r-footer-brand">
            <Brand />
            <p>
              A place to stay.
              <br />A new way to feel at home.
            </p>
            <span className="r-footer-brand-note">
              <Heart size={14} aria-hidden="true" /> Made for a little more
              living.
            </span>
          </div>
          <div>
            <h3>Support</h3>
            <Link to="/help">Help centre</Link>
            <Link to="/contact">Contact us</Link>
            <a href={rentalContact.callUrl}>Call {rentalContact.phone}</a>
            <Link to="/cancellation-policy">Cancellation options</Link>
            <Link to="/messages">Message your host</Link>
          </div>
          <div>
            <h3>Hosting</h3>
            <Link to="/host">List your home</Link>
            <Link to="/host/listings">Your listings</Link>
            <Link to="/host/calendar">Availability calendar</Link>
            <Link to="/host/reservations">Reservations</Link>
          </div>
          <div>
            <h3>Explore Omshivraj</h3>
            <Link to="/search">Find your next stay</Link>
            <Link to="/wishlists">Your wishlists</Link>
            <Link to="/trips">Your trips</Link>
            <Link to="/privacy">Privacy & your data</Link>
          </div>
        </div>
        <div className="r-footer-bottom">
          <div className="r-footer-legal">
            <span>© {new Date().getFullYear()} Omshivraj</span>
            <nav aria-label="Legal and support">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/help">Help centre</Link>
            </nav>
          </div>
          <div className="r-footer-preferences">
            <span>
              <Globe2 size={15} aria-hidden="true" /> English (IN)
            </span>
            <span>₹ INR</span>
            <button
              type="button"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)"
                  ).matches
                    ? "instant"
                    : "smooth",
                })
              }
            >
              Back to top <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
function RentalSite() {
  const config = useRentalResource<{ settings: { banner?: string } }>("/config")
  const { pathname, hash } = useLocation(),
    { notice, sessionError } = useRental()
  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }))
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  const adminWorkspace = pathname === "/admin" || pathname.startsWith("/admin/")
  const accountPage = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"].includes(pathname)
  const workspace = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/profile",
    "/wishlists",
    "/trips",
    "/messages",
    "/notifications",
    "/host",
    "/admin",
    "/help",
    "/contact",
    "/terms",
    "/privacy",
    "/cancellation-policy",
    "/experiences",
  ].some(
    (p) =>
      pathname === p ||
      (["/host", "/admin"].includes(p) && pathname.startsWith(p + "/"))
  )
  return (
    <div
      className={
        adminWorkspace
          ? "rental-app r-admin-page"
          : pathname === "/"
            ? "rental-app r-design-refresh r-bloom-home"
          : pathname.startsWith("/stays/")
            ? "rental-app r-design-refresh r-stay-page"
            : "rental-app r-design-refresh"
      }
    >
      <a className="r-skip" href="#r-main">
        Skip to content
      </a>
      <Header />
      {config.data?.settings.banner && (
        <div className="r-platform-banner">{config.data.settings.banner}</div>
      )}
      {sessionError && (
        <div className="r-setup-notice" role="alert">
          Account services are unavailable: {sessionError}
        </div>
      )}
      <main id="r-main">
        {pathname === "/" ? (
          <HomePage />
        ) : pathname === "/search" ? (
          <SearchPage />
        ) : pathname.startsWith("/stays/") ? (
          <StayPage />
        ) : workspace ? (
          <RentalWorkspace />
        ) : (
          <Empty
            title="This place hasn’t been discovered yet."
            body="Let’s get you back to somewhere familiar."
            action={
              <Link className="r-primary" to="/">
                Explore stays
              </Link>
            }
          />
        )}
      </main>
      {!adminWorkspace && (
        <>
          <Footer />
          {!accountPage && <nav className="r-mobile-nav" aria-label="Mobile navigation">
            <Link
              to="/search"
              aria-current={
                pathname === "/" || pathname === "/search" ? "page" : undefined
              }
            >
              <Search size={21} />
              Explore
            </Link>
            <Link
              to="/wishlists"
              aria-current={pathname === "/wishlists" ? "page" : undefined}
            >
              <Heart size={21} />
              Wishlists
            </Link>
            <Link
              to="/trips"
              aria-current={pathname === "/trips" ? "page" : undefined}
            >
              <Home size={21} />
              Trips
            </Link>
            <Link
              to="/messages"
              aria-current={pathname === "/messages" ? "page" : undefined}
            >
              <MessageCircle size={21} />
              Inbox
            </Link>
            <Link
              to="/profile"
              aria-current={pathname === "/profile" ? "page" : undefined}
            >
              <Users size={21} />
              Profile
            </Link>
          </nav>}
        </>
      )}
      {notice && (
        <div className="r-toast" role="status">
          <ShieldCheck size={18} />
          {notice}
        </div>
      )}
    </div>
  )
}
export function RentalApp() {
  return (
    <RentalProvider>
      <RentalSite />
    </RentalProvider>
  )
}
