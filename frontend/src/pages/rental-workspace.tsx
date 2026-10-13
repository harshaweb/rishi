import { rentalCheckout } from "../lib/rental-checkout"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom"
import {
  RentalDialog,
  rentalRequest,
  useRental,
  useRentalResource,
} from "../rental-state"
import {
  rentalMoney as money,
  rentalDate,
  rentalAmenities,
  rentalCategories,
  type RentalBooking,
  type RentalProperty,
} from "../../../server/shared/rentals"
import { RentalCard } from "./rentals"
import { rentalCities } from "../../../server/shared/rental-region"
import { rentalContact } from "../../../server/shared/rental-contact"
import { ApiError } from "../lib/api"
import {
  LayoutDashboard,
  Users,
  House,
  CalendarDays,
  CreditCard,
  RotateCcw,
  Star,
  Flag,
  Tags,
  TicketPercent,
  Settings2,
  ScrollText,
  UserRoundCheck,
  ArrowUpRight,
  ChevronRight,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

type Row = Record<string, unknown>
function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
}: {
  label: string
  name: string
  type?: string
  value?: string | number
  required?: boolean
}) {
  return (
    <label className="r-input-label">
      {label}
      <input
        name={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        defaultValue={value}
        required={required}
      />
    </label>
  )
}
function Form({
  children,
  submit,
  label = "Save changes",
}: {
  children: ReactNode
  submit: (data: FormData) => Promise<unknown>
  label?: string
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("")
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError("")
    setDone("")
    try {
      await submit(new FormData(e.currentTarget))
      setDone("Saved successfully.")
    } catch (e) {
      setError(
        e instanceof ApiError && Object.keys(e.fields).length
          ? Object.entries(e.fields)
              .map(([field, message]) => `${field}: ${message}`)
              .join(" · ")
          : (e as Error).message
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="r-form" onSubmit={send}>
      {children}
      {error && (
        <p className="r-error" role="alert">
          {error}
        </p>
      )}
      {done && <p role="status">{done}</p>}
      <button className="r-primary" disabled={busy}>
        {busy ? "Please wait…" : label}
      </button>
    </form>
  )
}
function Load({ error, loading }: { error: string; loading: boolean }) {
  return error ? (
    <p className="r-error" role="alert">
      {error}
    </p>
  ) : loading ? (
    <p role="status">Loading your workspace…</p>
  ) : null
}
function Guard({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { session, sessionError, refreshSession } = useRental(),
    { pathname } = useLocation()
  const [retrying, setRetrying] = useState(false)
  if (!session && sessionError)
    return (
      <div className="r-empty">
        <h2>Let’s reconnect your account.</h2>
        <p>Account services are temporarily unavailable. Please try again.</p>
        <button
          className="r-primary"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true)
            try {
              await refreshSession()
            } catch {
              // The provider exposes the latest error and allows another retry.
            } finally {
              setRetrying(false)
            }
          }}
        >
          {retrying ? "Reconnecting…" : "Try again"}
        </button>
      </div>
    )
  if (!session) return <p role="status">Checking your account…</p>
  if (!session.user)
    return (
      <div className="r-empty">
        <h2>A place for your plans.</h2>
        <p>Log in to access your account.</p>
        <Link
          className="r-primary"
          to={`/login?next=${encodeURIComponent(pathname)}`}
        >
          Log in
        </Link>
      </div>
    )
  if (roles && !roles.includes(session.user.role))
    return (
      <div className="r-empty">
        <h2>Hosting starts with approval.</h2>
        <Link to="/host">Apply to host</Link>
      </div>
    )
  return children
}
function Auth() {
  const { pathname, search } = useLocation(),
    navigate = useNavigate(),
    { session, refreshSession } = useRental()
  const [message, setMessage] = useState(""),
    [dev, setDev] = useState(""),
    [showPassword, setShowPassword] = useState(false)
  const signup = pathname === "/signup",
    login = pathname === "/login",
    verify = pathname === "/verify-email",
    reset = pathname === "/reset-password"
  const requestedNext = new URLSearchParams(search).get("next") || "/trips"
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/trips"
  const nextQuery = `?next=${encodeURIComponent(next)}`
  const title = signup
    ? "Welcome to Omshivraj."
    : login
      ? "Welcome back."
      : verify
        ? "Verify your email."
        : reset
          ? "A fresh start."
          : "Forgot your password?"
  return (
    <div className="r-auth">
      <div className="r-auth-art">
        <img
          src="/gallery/photo-22.jpg"
          alt="Balcony seating with a round table and neighbourhood views"
        />
        <div>
          <span>MAKE ROOM FOR SOMETHING GOOD</span>
          <h2>
            A little escape.
            <br />A lot to remember.
          </h2>
        </div>
      </div>
      <div className="r-auth-form">
        <span className="r-kicker">YOUR NEXT CHAPTER</span>
        <h1>{title}</h1>
        <p className="r-muted">
          {signup
            ? "Discover stays, save favourites, and make yourself at home."
            : verify
              ? "Confirm your email before requesting your first stay."
              : "Your favourite places are waiting."}
        </p>
        {message ? (
          <div role="status">
            <p>{message}</p>
            {dev && (
              <p>
                Development only:{" "}
                <a href={dev}>Open verification / reset link</a>
              </p>
            )}
            <Link className="r-primary" to={`/login${nextQuery}`}>
              Continue to log in
            </Link>
          </div>
        ) : (
          <Form
            label={
              signup
                ? "Create account"
                : login
                  ? "Log in"
                  : verify
                    ? "Verify email"
                    : reset
                      ? "Reset password"
                      : "Send reset link"
            }
            submit={async (f) => {
              if (
                (signup || reset) &&
                f.get("password") !== f.get("confirmPassword")
              )
                throw new Error(
                  "Your passwords don’t match. Please enter the same password in both fields."
                )
              const data = Object.fromEntries(f)
              delete data.confirmPassword
              const result = await rentalRequest<{
                message?: string
                developmentLink?: string
                emailStatus?: string
              }>(pathname, {
                ...data,
                ...(signup ? { consent: f.get("consent") === "on" } : {}),
                ...(verify || reset
                  ? { token: new URLSearchParams(search).get("token") || "" }
                  : {}),
              })
              if (login) {
                await refreshSession()
                navigate(
                  next.startsWith("/") && !next.startsWith("//")
                    ? next
                    : "/trips"
                )
              } else {
                setMessage(
                  signup &&
                    !result.developmentLink &&
                    result.emailStatus !== "PROVIDER_ACCEPTED"
                    ? "Your account was created, but we couldn’t send the verification email. Please contact support on +91 70781 77772 before requesting a stay."
                    : !signup &&
                        !verify &&
                        !reset &&
                        !result.developmentLink &&
                        (session?.emailConfigured === false ||
                          result.emailStatus === "NOT_CONFIGURED" ||
                          result.emailStatus === "FAILED")
                      ? "If you have an account, contact support on +91 70781 77772 for help recovering access. Password reset email delivery is currently unavailable."
                      : result.message || "Request received. Check your email."
                )
                setDev(result.developmentLink || "")
                await refreshSession()
              }
            }}
          >
            {signup && <Field name="name" label="Full name" />}
            {!verify && !reset && (
              <Field name="email" label="Email address" type="email" />
            )}
            {(login || signup || reset) && (
              <label className="r-input-label">
                Password
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  minLength={login ? 1 : 12}
                  maxLength={72}
                  autoComplete={login ? "current-password" : "new-password"}
                  required
                />
                {!login && <small>Use at least 12 characters.</small>}
              </label>
            )}
            {(signup || reset) && (
              <label className="r-input-label">
                Confirm password
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
              </label>
            )}
            {(login || signup || reset) && (
              <label className="r-check">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                Show password
              </label>
            )}
            {signup && (
              <label className="r-check">
                <input type="checkbox" name="consent" required />
                <span>I agree to the <Link to="/terms">terms</Link> and{" "}
                <Link to="/privacy">privacy policy</Link>.</span>
              </label>
            )}
          </Form>
        )}
        <div className="r-auth-links">
          <Link to={`${signup ? "/login" : "/signup"}${nextQuery}`}>
            {signup
              ? "Already have an account? Log in"
              : "New here? Create an account"}
          </Link>
          <Link to={`/forgot-password${nextQuery}`}>Forgot password?</Link>
        </div>
      </div>
    </div>
  )
}
function Profile() {
  const { session, refreshSession, notify } = useRental(),
    u = session!.user!
  return (
    <div className="r-panel">
      <h2>Personal information</h2>
      <p>
        {u.email} ·{" "}
        {u.verified ? "Email verified" : "Email verification required"}
      </p>
      {!u.verified && (
        <button
          className="r-secondary"
          onClick={async () => {
            try {
              const d = await rentalRequest<{
                developmentLink?: string
                emailStatus: string
              }>("/resend-verification")
              notify(
                d.developmentLink
                  ? `Development verification link: ${d.developmentLink}`
                  : d.emailStatus === "PROVIDER_ACCEPTED"
                    ? "Verification email sent. Please check your inbox."
                    : "We couldn’t send the verification email. Please contact support on +91 70781 77772."
              )
            } catch (e) {
              notify((e as Error).message)
            }
          }}
        >
          Resend verification
        </button>
      )}
      <Form
        submit={async (f) => {
          await rentalRequest(
            "/profile",
            {
              name: f.get("name"),
              phone: f.get("phone"),
              notifications: f.get("notifications") === "on",
            },
            "PATCH"
          )
          await refreshSession()
        }}
      >
        <Field name="name" label="Name" value={u.name} />
        <Field
          name="phone"
          label="Phone (international format)"
          value={u.phone || ""}
          required={false}
        />
        <label className="r-check">
          <input
            type="checkbox"
            name="notifications"
            defaultChecked={u.notifications !== false}
          />
          Email notifications
        </label>
      </Form>
      <h3>Profile photo</h3>
      {u.photo && (
        <img className="r-avatar-photo" src={u.photo} alt="Your profile" />
      )}
      <Form
        label="Upload photo"
        submit={async (f) => {
          await rentalRequest("/profile/photo", f)
          await refreshSession()
        }}
      >
        <label className="r-input-label">
          JPEG, PNG or WebP · up to 4 MB
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </label>
      </Form>
    </div>
  )
}
function Wishlists() {
  const q = useRentalResource<{
      lists: { id: string; name: string; propertyIds: string[] }[]
      items: RentalProperty[]
    }>("/wishlists"),
    { changedSaved, notify } = useRental()
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null)
  async function update(path: string, body?: unknown, method = "POST") {
    try {
      await rentalRequest(path, body, method)
      q.refresh()
      changedSaved()
    } catch (e) {
      notify((e as Error).message)
    }
  }
  return (
    <>
      <Form
        label="Create wishlist"
        submit={async (f) => update("/wishlists", { name: f.get("name") })}
      >
        <Field name="name" label="Name your next adventure" />
      </Form>
      <Load {...q} />
      {q.data?.lists.map((l) => (
        <section className="r-stay-section" key={l.id}>
          <div className="r-section-heading">
            <h2>{l.name}</h2>
            <div>
              <button className="r-text-button" onClick={() => setEdit(l)}>
                Manage list
              </button>
            </div>
          </div>
          <div className="r-card-grid">
            {q.data?.items
              .filter((p) => l.propertyIds.includes(p.id))
              .map((p) => (
                <div key={p.id}>
                  <RentalCard property={p} />
                  <button
                    className="r-text-button"
                    onClick={() =>
                      update(
                        `/wishlists/${l.id}/items/${p.id}`,
                        undefined,
                        "DELETE"
                      )
                    }
                  >
                    Remove from this list
                  </button>
                </div>
              ))}
          </div>
          {!l.propertyIds.length && (
            <p>Save a stay with its heart button to start collecting ideas.</p>
          )}
        </section>
      ))}
      {edit && (
        <RentalDialog title="Manage wishlist" close={() => setEdit(null)}>
          <Form
            submit={async (f) => {
              await update(
                `/wishlists/${edit.id}`,
                { name: f.get("name") },
                "PATCH"
              )
              setEdit(null)
            }}
          >
            <Field name="name" label="Wishlist name" value={edit.name} />
          </Form>
          <button
            className="r-text-button"
            onClick={async () => {
              await update(`/wishlists/${edit.id}`, undefined, "DELETE")
              setEdit(null)
            }}
          >
            Delete this wishlist
          </button>
        </RentalDialog>
      )}
    </>
  )
}
function Trips({ host = false }: { host?: boolean }) {
  const q = useRentalResource<RentalBooking[]>(
      host ? "/host/reservations" : "/bookings"
    ),
    { notify } = useRental()
  const [filter, setFilter] = useState("ALL"),
    [paying, setPaying] = useState<string | null>(null),
    [cancel, setCancel] = useState<RentalBooking | null>(null),
    [review, setReview] = useState<RentalBooking | null>(null)
  async function act(path: string, body?: unknown) {
    await rentalRequest(path, body)
    q.refresh()
  }
  return (
    <>
      <div className="r-chip-bar">
        {["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map((s) => (
          <button
            className={s === filter ? "active" : ""}
            onClick={() => setFilter(s)}
            key={s}
          >
            {s.toLowerCase().replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <Load {...q} />
      {q.data?.length === 0 && (
        <div className="r-empty">
          <h2>Your next adventure is still ahead.</h2>
          <Link to="/search">Explore stays</Link>
        </div>
      )}
      <div className="r-bookings">
        {q.data
          ?.filter((b) => filter === "ALL" || b.status === filter)
          .map((b) => (
            <article className="r-panel r-trip" key={b.id}>
              <img src={b.image || "/gallery/photo-01.jpg"} alt={b.title} />
              <div>
                <span className="r-badge">{b.status.replaceAll("_", " ")}</span>
                <h2>
                  <Link to={`/stays/${b.slug}`}>{b.title}</Link>
                </h2>
                <p>
                  {b.city} · {rentalDate(b.checkIn)} – {rentalDate(b.checkOut)}{" "}
                  · {b.guests} guests
                </p>
                <p>
                  {b.reference}
                  {host && ` · ${b.guestName}`}
                </p>
                {b.address && ["CONFIRMED", "COMPLETED"].includes(b.status) && (
                  <p><strong>Property address:</strong> {b.address}</p>
                )}
                <b>{money(b.total)}</b>
                <p>
                  Payment: {b.paymentStatus.replaceAll("_", " ").toLowerCase()}
                </p>
                {b.expiresAt && b.status === "PENDING" && (
                  <small>
                    Request expires {new Date(b.expiresAt).toLocaleString()}
                  </small>
                )}
                <div className="r-button-row">
                  {b.status === "PENDING" &&
                    host &&
                    b.bookingMode === "HOST_APPROVAL" && (
                      <button
                        className="r-primary"
                        onClick={() =>
                          act(`/host/reservations/${b.id}/accept`).catch((e) =>
                            notify(e.message)
                          )
                        }
                      >
                        Accept request
                      </button>
                    )}
                  {b.status === "PENDING" &&
                    !host &&
                    b.bookingMode === "PAYMENT" && (
                      <button
                        className="r-primary"
                        disabled={paying !== null}
                        aria-busy={paying === b.id}
                        onClick={async () => {
                          setPaying(b.id)
                          try {
                            await rentalCheckout(b, q.refresh, notify)
                          } finally {
                            setPaying(null)
                          }
                        }}
                      >
                        {paying === b.id
                          ? "Opening secure checkout…"
                          : `Pay ${money(b.total)} securely`}
                      </button>
                    )}
                  {["PENDING", "CONFIRMED"].includes(b.status) && (
                    <button
                      className="r-secondary"
                      onClick={() => setCancel(b)}
                    >
                      {host ? "Decline / cancel" : "Cancel reservation"}
                    </button>
                  )}
                  {!host &&
                    !b.reviewId &&
                    ["CONFIRMED", "COMPLETED"].includes(b.status) &&
                    new Date(b.checkOut) < new Date() && (
                      <button
                        className="r-secondary"
                        onClick={() => setReview(b)}
                      >
                        Write review
                      </button>
                    )}
                  <Link className="r-text-button" to="/messages">
                    Messages
                  </Link>
                </div>
              </div>
            </article>
          ))}
      </div>
      {cancel && (
        <RentalDialog
          title="Cancel this reservation?"
          close={() => setCancel(null)}
        >
          <p>
            Cancellation releases your dates. Any paid refund follows the stay’s
            cancellation policy and is processed separately through the payment
            provider. Pay-at-property requests have no online payment to refund.
          </p>
          <p>
            Agreed cancellation policy:{" "}
            <b>{cancel.cancellation.toLowerCase()}</b>. The policy saved with
            this reservation applies even if the host edits the listing.
          </p>
          <Link to="/cancellation-policy">
            Read cancellation policy definitions
          </Link>
          <Form
            label="Confirm cancellation"
            submit={async (f) => {
              const r = await rentalRequest<{ message: string }>(
                `/bookings/${cancel.id}/cancel`,
                { reason: f.get("reason") }
              )
              notify(r.message)
              q.refresh()
              setCancel(null)
            }}
          >
            <Field name="reason" label="Reason for cancellation" />
          </Form>
        </RentalDialog>
      )}
      {review && (
        <RentalDialog title="How was your stay?" close={() => setReview(null)}>
          <Form
            label="Publish review"
            submit={async (f) => {
              await act(`/bookings/${review.id}/review`, {
                rating: Number(f.get("rating")),
                body: f.get("body"),
              })
              setReview(null)
            }}
          >
            <label className="r-input-label">
              Rating
              <select name="rating">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="r-input-label">
              Your experience
              <textarea name="body" maxLength={3000} required />
            </label>
          </Form>
        </RentalDialog>
      )}
    </>
  )
}
function Messages() {
  const q =
      useRentalResource<
        { id: string; title: string; preview: string; unread: number }[]
      >("/conversations"),
    [selected, setSelected] = useState(""),
    { session } = useRental()
  const thread = useRentalResource<
    {
      id: string
      name: string
      body: string
      senderId: string
      createdAt: string
    }[]
  >(selected ? `/conversations/${selected}` : null)
  const refreshInbox = q.refresh,
    refreshThread = thread.refresh
  useEffect(() => {
    const timer = setInterval(() => {
      refreshInbox()
      if (selected) refreshThread()
    }, 20000)
    return () => clearInterval(timer)
  }, [refreshInbox, refreshThread, selected])
  return (
    <div className="r-inbox">
      <aside>
        <Load {...q} />
        {!q.data?.length && (
          <p>Contact a host from a stay page to start a conversation.</p>
        )}
        {q.data?.map((c) => (
          <button
            key={c.id}
            className={selected === c.id ? "active" : ""}
            onClick={() => setSelected(c.id)}
          >
            <b>{c.title}</b>
            <span>{c.preview}</span>
            {c.unread > 0 && <small>{c.unread} unread</small>}
          </button>
        ))}
      </aside>
      <section className="r-panel">
        <Load {...thread} />
        {!selected ? (
          <p>Select a conversation to get started.</p>
        ) : (
          <>
            <div className="r-message-history">
              {thread.data?.map((m) => (
                <div
                  className={`r-message ${m.senderId === session?.user?.id ? "own" : ""}`}
                  key={m.id}
                >
                  <b>{m.name}</b>
                  <p>{m.body}</p>
                  <small>{new Date(m.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
            <Form
              label="Send message"
              submit={async (f) => {
                await rentalRequest(`/conversations/${selected}`, {
                  body: f.get("body"),
                })
                thread.refresh()
                q.refresh()
              }}
            >
              <label className="r-input-label">
                Message
                <textarea name="body" maxLength={3000} required />
              </label>
            </Form>
          </>
        )}
      </section>
    </div>
  )
}
function Notifications() {
  const q = useRentalResource<
    {
      id: string
      body: string
      link: string
      readAt: string | null
      createdAt: string
    }[]
  >("/notifications")
  return (
    <>
      <button
        className="r-secondary"
        onClick={() => rentalRequest("/notifications/read").then(q.refresh)}
      >
        Mark all as read
      </button>
      <Load {...q} />
      {q.data?.map((n) => (
        <Link className="r-panel r-notification" key={n.id} to={n.link}>
          <b>
            {n.readAt ? "" : "● "}
            {n.body}
          </b>
          <small>{new Date(n.createdAt).toLocaleString()}</small>
        </Link>
      ))}
    </>
  )
}
function HostIntro() {
  const { session } = useRental(),
    q = useRentalResource<{ status?: string } | null>(
      session?.user ? "/host/status" : null
    )
  return (
    <div className="r-host-intro">
      <img
        src="/gallery/photo-23.jpg"
        alt="An inviting space ready for guests"
      />
      <div>
        <span className="r-kicker">A HOME WORTH SHARING</span>
        <h1>
          Your space.
          <br />
          Their next story.
        </h1>
        <p>
          Bring your place to Omshivraj. You control your listing, nightly rate,
          availability and reservation requests.
        </p>
        {!session?.user ? (
          <Link className="r-primary" to="/signup">
            Start hosting
          </Link>
        ) : ["HOST", "ADMIN"].includes(session.user.role) ? (
          <Link className="r-primary" to="/host/listings">
            Open host workspace
          </Link>
        ) : q.data?.status === "PENDING" ? (
          <p role="status">
            Your hosting application is awaiting administrator approval.
          </p>
        ) : (
          <Form
            label="Apply to host"
            submit={async (f) => {
              await rentalRequest("/host/onboard", { bio: f.get("bio") })
              q.refresh()
            }}
          >
            <label className="r-input-label">
              Tell us about yourself and your property
              <textarea name="bio" required maxLength={2000} />
            </label>
          </Form>
        )}
        <p className="r-muted r-small">
          Applications and listings require review. Add accurate property details,
          photos, prices, and availability before submitting your listing.
        </p>
      </div>
    </div>
  )
}
function HostNav() {
  return (
    <nav className="r-workspace-nav">
      {["listings", "calendar", "reservations", "earnings", "reviews"].map(
        (t) => (
          <NavLink to={`/host/${t}`} key={t}>
            {t}
          </NavLink>
        )
      )}
      <Link to="/messages">Messages</Link>
    </nav>
  )
}
function ListingEditor({ id }: { id?: string }) {
  const catalog = useRentalResource<{ categories: string[] }>("/config")
  const navigate = useNavigate(),
    q = useRentalResource<RentalProperty>(id ? `/host/listings/${id}` : null),
    photos = useRentalResource<{ id: string; url: string }[]>(
      id ? `/host/listings/${id}/photos` : null
    ),
    { notify, session } = useRental()
  if (id && !q.data) return <Load {...q} />
  const p = q.data
  return (
    <>
      <Link
        to={
          session?.user?.role === "ADMIN" ? "/admin/listings" : "/host/listings"
        }
      >
        ← All listings
      </Link>
      <div className="r-panel">
        <h2>{id ? "Edit your stay" : "Make room for your first guests"}</h2>
        <p>
          Amounts are in INR. Changes return the listing to draft for
          moderation.
        </p>
        <Form
          label={id ? "Save listing" : "Create draft"}
          submit={async (f) => {
            const d = Object.fromEntries(f)
            const result = await rentalRequest<{ id: string }>(
              id ? `/host/listings/${id}` : "/host/listings",
              {
                ...d,
                nightlyRate: Math.round(Number(d.nightlyRate) * 100),
                cleaningFee: Math.round(Number(d.cleaningFee) * 100),
                instantBook: f.get("instantBook") === "on",
                amenities: f.getAll("amenities"),
              },
              id ? "PATCH" : "POST"
            )
            if (!id) navigate(`/host/listings/${result.id}/edit`)
            else q.refresh()
          }}
        >
          <div className="r-form-grid">
            <Field name="title" label="Listing title" value={p?.title} />
            <Field
              name="slug"
              label="URL slug (lowercase words with hyphens)"
              value={p?.slug}
            />
            <label className="r-input-label">
              City in Delhi NCR
              <select name="city" defaultValue={p?.city || "Delhi"} required>
                {rentalCities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <Field name="address" label="Full address" value={p?.address} />
            <label className="r-input-label">
              Property type
              <select name="type" defaultValue={p?.type}>
                {[
                  "Apartment",
                  "Villa",
                  "Cottage",
                  "Cabin",
                  "Homestay",
                  "House",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="r-input-label">
              Category
              <select name="category" defaultValue={p?.category}>
                {(catalog.data?.categories || rentalCategories).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {[
              ["nightlyRate", "Nightly rate ₹", p ? p.nightlyRate / 100 : 2500],
              ["cleaningFee", "Cleaning fee ₹", p ? p.cleaningFee / 100 : 0],
              ["capacity", "Guests", p?.capacity || 2],
              ["bedrooms", "Bedrooms", p?.bedrooms ?? 1],
              ["beds", "Beds", p?.beds || 1],
              ["bathrooms", "Bathrooms", p?.bathrooms || 1],
            ].map(([name, label, value]) => (
              <Field
                key={String(name)}
                name={String(name)}
                label={String(label)}
                value={Number(value)}
                type="number"
              />
            ))}
            {(["latitude", "longitude"] as const).map((name) => (
              <Field key={name} name={name} label={`${name === "latitude" ? "Latitude" : "Longitude"} (optional)`} value={p?.[name] ?? ""} type="number" required={false} />
            ))}
            <Field
              name="checkInTime"
              label="Check-in time"
              type="time"
              value={p?.checkInTime || "15:00"}
            />
            <Field
              name="checkOutTime"
              label="Checkout time"
              type="time"
              value={p?.checkOutTime || "11:00"}
            />
            <Field
              name="discountPercent"
              label="Nightly discount percent (0–50)"
              type="number"
              value={p?.discountPercent || 0}
            />
            <label className="r-input-label">
              Cancellation policy
              <select name="cancellation" defaultValue={p?.cancellation}>
                {["FLEXIBLE", "MODERATE", "STRICT"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="r-input-label">
              Booking method
              <select name="bookingMode" defaultValue={p?.bookingMode}>
                <option value="HOST_APPROVAL">
                  Host approval · pay at property
                </option>
                <option value="PAYMENT">Verified online payment</option>
              </select>
            </label>
          </div>
          <label className="r-input-label">
            House rules
            <textarea
              name="houseRules"
              required
              defaultValue={p?.houseRules || "No parties or smoking indoors."}
            />
          </label>
          <label className="r-input-label">
            Description
            <textarea
              name="description"
              defaultValue={p?.description}
              maxLength={10000}
              required
              rows={6}
            />
          </label>
          <div className="r-checkbox-grid">
            {rentalAmenities.map((a) => (
              <label className="r-check" key={a}>
                <input
                  name="amenities"
                  type="checkbox"
                  value={a}
                  defaultChecked={p?.amenities.includes(a)}
                />
                {a}
              </label>
            ))}
          </div>
          <label className="r-check">
            <input
              type="checkbox"
              name="instantBook"
              defaultChecked={p?.instantBook}
            />
            Instant book (requires online payment)
          </label>
        </Form>
      </div>
      {id && (
        <div className="r-panel">
          <h2>Your photos</h2>
          <Form
            label="Upload photo"
            submit={async (f) => {
              await rentalRequest(`/host/listings/${id}/photos`, f)
              photos.refresh()
            }}
          >
            <label className="r-input-label">
              Property photo (up to 4 MB)
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
          </Form>
          <div className="r-photo-editor">
            {photos.data?.map((photo, i) => (
              <div key={photo.id}>
                <img src={photo.url} alt={`Property photo ${i + 1}`} />
                <button
                  className="r-text-button"
                  disabled={i === 0}
                  onClick={async () => {
                    try {
                      const ids = photos.data!.map((x) => x.id)
                      ;[ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]
                      await rentalRequest(
                        `/host/listings/${id}/photos`,
                        { ids },
                        "PATCH"
                      )
                      photos.refresh()
                    } catch (e) {
                      notify((e as Error).message)
                    }
                  }}
                >
                  Move earlier
                </button>
                <button
                  className="r-text-button"
                  onClick={() =>
                    rentalRequest(
                      `/host/listings/${id}/photos/${photo.id}`,
                      undefined,
                      "DELETE"
                    )
                      .then(photos.refresh)
                      .catch((e) => notify(e.message))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            className="r-primary"
            onClick={() =>
              rentalRequest(`/host/listings/${id}/publish`, { publish: true })
                .then(() => {
                  notify("Listing submitted for publication.")
                  q.refresh()
                })
                .catch((e) => notify(e.message))
            }
          >
            Submit for publication
          </button>
        </div>
      )}
    </>
  )
}
function HostListings() {
  const q = useRentalResource<RentalProperty[]>("/host/listings"),
    { notify } = useRental()
  return (
    <>
      <Link className="r-primary" to="/host/listings/new">
        + Add a stay
      </Link>
      <Load {...q} />
      <div className="r-card-grid">
        {q.data?.map((p) => (
          <div className="r-panel" key={p.id}>
            <h2>{p.title}</h2>
            <p>
              {p.city} · {money(p.nightlyRate)} / night
            </p>
            <span className="r-badge">{p.status}</span>
            <div className="r-button-row">
              <Link to={`/host/listings/${p.id}/edit`}>Edit listing</Link>
              <Link to={`/host/listings/${p.id}/preview`}>Preview listing</Link>
              <button
                className="r-text-button"
                onClick={() =>
                  rentalRequest(`/host/listings/${p.id}/publish`, {
                    publish: p.status !== "PUBLISHED",
                  })
                    .then(q.refresh)
                    .catch((e) => notify(e.message))
                }
              >
                {p.status === "PUBLISHED" ? "Unpublish" : "Submit for review"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
function Calendar() {
  const q = useRentalResource<
      {
        id: string
        title: string
        start: string
        end: string
        reason: string
      }[]
    >("/host/calendar"),
    listings = useRentalResource<RentalProperty[]>("/host/listings"),
    reservations = useRentalResource<RentalBooking[]>("/host/reservations"),
    { notify } = useRental()
  return (
    <>
      <div className="r-panel">
        <h2>Block dates</h2>
        <p>End date is exclusive. Existing reservations cannot be blocked.</p>
        <Form
          label="Block dates"
          submit={async (f) => {
            await rentalRequest(
              `/host/listings/${f.get("propertyId")}/blocks`,
              {
                start: f.get("start"),
                end: f.get("end"),
                reason: f.get("reason"),
              }
            )
            q.refresh()
          }}
        >
          <label className="r-input-label">
            Stay
            <select name="propertyId" required>
              {listings.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <div className="r-form-grid">
            <Field name="start" type="date" label="Start date" />
            <Field name="end" type="date" label="End date" />
          </div>
          <Field name="reason" label="Reason" required={false} />
        </Form>
      </div>
      <Load {...q} />
      {q.data?.map((d) => (
        <div className="r-panel" key={d.id}>
          <b>{d.title}</b>
          <p>
            {rentalDate(d.start)} – {rentalDate(d.end)} · {d.reason}
          </p>
          <button
            className="r-text-button"
            onClick={() =>
              rentalRequest(`/host/blocks/${d.id}`, undefined, "DELETE")
                .then(q.refresh)
                .catch((e) => notify(e.message))
            }
          >
            Unblock dates
          </button>
        </div>
      ))}
      <h2>Reserved nights</h2>
      {reservations.data
        ?.filter((b) =>
          ["PENDING", "CONFIRMED", "COMPLETED"].includes(b.status)
        )
        .map((b) => (
          <p key={b.id}>
            {b.title}: {rentalDate(b.checkIn)} – {rentalDate(b.checkOut)} ·{" "}
            {b.status}
          </p>
        ))}
    </>
  )
}
function Earnings() {
  const q = useRentalResource<
    {
      reference: string
      title: string
      total: number
      refund: number
      platformFee: number
      paymentStatus: string
    }[]
  >("/host/earnings")
  return (
    <>
      <p>
        Online receipts and amounts due at the property are shown separately.
        These records do not represent a bank payout.
      </p>
      <Load {...q} />
      <div className="r-stat-grid">
        <div className="r-panel">
          <span>Captured online, less refunds and platform fees</span>
          <h2>
            {money(
              (q.data || [])
                .filter((b) => b.paymentStatus === "PAID")
                .reduce((s, b) => s + b.total - b.platformFee - b.refund, 0)
            )}
          </h2>
        </div>
        <div className="r-panel">
          <span>Due at property · not collected online</span>
          <h2>
            {money(
              (q.data || [])
                .filter((b) => b.paymentStatus === "PAY_AT_PROPERTY")
                .reduce((s, b) => s + b.total, 0)
            )}
          </h2>
        </div>
      </div>
      <div className="r-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Stay</th>
              <th>Total</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((b) => (
              <tr key={b.reference}>
                <td>{b.reference}</td>
                <td>{b.title}</td>
                <td>{money(b.total)}</td>
                <td>{b.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
function HostReviews() {
  const q = useRentalResource<
    {
      id: string
      rating: number
      body: string
      response: string
      title: string
      name: string
    }[]
  >("/host/reviews")
  return (
    <>
      <Load {...q} />
      {!q.data?.length && (
        <p>Reviews appear here after eligible guests complete their stays.</p>
      )}
      {q.data?.map((r) => (
        <div className="r-panel" key={r.id}>
          <h2>{r.title}</h2>
          <b>
            {r.rating} stars · {r.name}
          </b>
          <p>{r.body}</p>
          <Form
            label="Save response"
            submit={async (f) => {
              await rentalRequest(
                `/host/reviews/${r.id}`,
                { response: f.get("response") },
                "PATCH"
              )
              q.refresh()
            }}
          >
            <label className="r-input-label">
              Your public response
              <textarea
                name="response"
                required
                maxLength={3000}
                defaultValue={r.response}
              />
            </label>
          </Form>
        </div>
      ))}
    </>
  )
}
function ListingPreview({ id }: { id: string }) {
  const q = useRentalResource<RentalProperty>(`/host/listings/${id}`)
  if (!q.data) return <Load {...q} />
  const p = q.data
  return (
    <div className="r-panel">
      <span className="r-badge">PRIVATE PREVIEW · {p.status}</span>
      <h1>{p.title}</h1>
      <p>
        {p.city} · {p.capacity} guests · {money(p.nightlyRate)} per night
      </p>
      <div className="r-photo-editor">
        {p.images.map((url, i) => (
          <img src={url} key={url + i} alt={`Listing photo ${i + 1}`} />
        ))}
      </div>
      <p>{p.description}</p>
      <h3>Amenities</h3>
      <p>{p.amenities.join(" · ")}</p>
      <h3>House rules</h3>
      <p>
        Check-in {p.checkInTime} · Checkout {p.checkOutTime}
      </p>
      <p>{p.houseRules}</p>
      <p>Cancellation: {p.cancellation}</p>
      <Link className="r-secondary" to={`/host/listings/${id}/edit`}>
        Edit this listing
      </Link>
    </div>
  )
}
const entities = [
  "users",
  "hosts",
  "listings",
  "bookings",
  "payments",
  "refunds",
  "reviews",
  "reports",
  "categories",
  "coupons",
  "settings",
  "audit",
]
const adminSections = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    group: "Workspace",
  },
  { key: "bookings", label: "Reservations", icon: CalendarDays },
  { key: "listings", label: "Properties", icon: House },
  { key: "users", label: "Guests & users", icon: Users },
  { key: "hosts", label: "Hosts", icon: UserRoundCheck },
  { key: "payments", label: "Payments", icon: CreditCard, group: "Operations" },
  { key: "refunds", label: "Refunds", icon: RotateCcw },
  { key: "reviews", label: "Reviews", icon: Star },
  { key: "reports", label: "Support reports", icon: Flag },
  { key: "categories", label: "Categories", icon: Tags, group: "Management" },
  { key: "coupons", label: "Coupons", icon: TicketPercent },
  { key: "settings", label: "Settings", icon: Settings2 },
  { key: "audit", label: "Activity log", icon: ScrollText },
]
const adminColumns: Record<string, string[]> = {
  users: ["name", "email", "role", "verified", "active", "createdAt"],
  hosts: ["userId", "bio", "status", "createdAt"],
  listings: ["title", "city", "type", "nightlyRate", "status", "demo"],
  bookings: ["reference", "checkIn", "checkOut", "guests", "total", "status"],
  payments: [
    "orderId",
    "paymentId",
    "amount",
    "currency",
    "status",
    "createdAt",
  ],
  refunds: ["bookingId", "amount", "status", "createdAt"],
  reviews: ["rating", "body", "visible", "createdAt"],
  reports: ["body", "targetId", "status", "createdAt"],
  categories: ["name", "active"],
  coupons: ["code", "percent", "active", "expiresAt"],
  settings: ["key", "value"],
  audit: ["action", "entityId", "createdAt"],
}
const adminFieldLabels: Record<string, string> = {
  nightlyRate: "Per night",
  createdAt: "Created",
  userId: "Host ID",
  percent: "Discount %",
  demo: "Demo listing",
  paid: "Online payments",
}
const adminLabel = (key: string) =>
  adminFieldLabels[key] || key.replace(/([A-Z])/g, " $1")
function AdminValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === "")
    return <span className="r-muted">—</span>
  if (typeof value === "boolean" || field === "status" || field === "role") {
    const text =
      typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)
    const tone = [
      "Yes",
      "PUBLISHED",
      "APPROVED",
      "CONFIRMED",
      "CAPTURED",
      "RESOLVED",
      "PROCESSED",
    ].includes(text)
      ? "positive"
      : ["PENDING", "CREATED", "OPEN"].includes(text)
        ? "pending"
        : "neutral"
    return (
      <span className={`r-admin-badge ${tone}`}>
        {text.replaceAll("_", " ").toLowerCase()}
      </span>
    )
  }
  if (["nightlyRate", "amount", "total"].includes(field))
    return <strong>{money(Number(value))}</strong>
  if (["createdAt", "expiresAt", "checkIn", "checkOut"].includes(field))
    return <span>{rentalDate(String(value))}</span>
  return (
    <span title={String(value)}>
      {String(value)
        .replaceAll(field === "action" ? "_" : "\u0000", " ")
        .slice(0, 110)}
    </span>
  )
}
function Admin() {
  const location = useLocation(),
    navigate = useNavigate()
  const section = location.pathname.split("/")[2]
  const entity = entities.includes(section) ? section : "overview"
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [reservationFilter, setReservationFilter] = useState("ALL"),
    [selected, setSelected] = useState<Row | null>(null),
    { notify, session } = useRental()
  const overview = useRentalResource<Record<string, number>>("/admin/overview"),
    q = useRentalResource<{ items: Row[]; total: number }>(
      entity === "overview"
        ? null
        : `/admin/${entity}?page=${entity === "settings" ? 1 : page}&search=${encodeURIComponent(entity === "settings" ? "" : search)}`
    )
  const recent = useRentalResource<{ items: Row[]; total: number }>(
    entity === "overview" ? "/admin/bookings" : null
  )
  const activity = useRentalResource<{ items: Row[]; total: number }>(
    entity === "overview" ? "/admin/audit" : null
  )
  const columns = adminColumns[entity] || []
  const currentSection = adminSections.find(
    (section) => section.key === entity
  )!
  const highlights = useRentalResource<{ items: RentalProperty[] }>(
    entity === "overview" ? "/search" : null
  )
  const reservationItems = (recent.data?.items || []).filter(
    (row) => reservationFilter === "ALL" || row.status === reservationFilter
  )
  function openSection(key: string) {
    navigate(key === "overview" ? "/admin" : `/admin/${key}`)
    setPage(1)
    setSearch("")
  }
  function refresh() {
    overview.refresh()
    q.refresh()
    recent.refresh()
    activity.refresh()
    highlights.refresh()
  }
  async function act(path: string, data: unknown, method = "POST") {
    await rentalRequest(path, data, method)
    q.refresh()
    overview.refresh()
    setSelected(null)
    notify("Changes saved to the database.")
  }
  const items = q.data?.items || []
  function exportRows() {
    const keys = Object.keys(items[0] || {}),
      csv = [keys, ...items.map((r) => keys.map((k) => String(r[k] ?? "")))]
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/^[=+\-@]/, "'")
                  .replaceAll('"', '""') +
                '"'
            )
            .join(",")
        )
        .join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      a = document.createElement("a")
    a.href = url
    a.download = `omshivraj-${entity}-page-${page}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="r-admin-shell r-control-center">
      <aside className="r-admin-sidebar">
        <div className="r-admin-brand">
          <span>
            <House size={22} />
          </span>
          <div>
            <b>Omshivraj.</b>
            <small>ADMIN WORKSPACE</small>
          </div>
        </div>
        <nav aria-label="Admin navigation">
          {adminSections.map(({ key, label, icon: Icon, group }) => (
            <div key={key}>
              {group && <p className="r-admin-nav-label">{group}</p>}
              <button
                className={entity === key ? "active" : ""}
                aria-current={entity === key ? "page" : undefined}
                onClick={() => openSection(key)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {key === "hosts" && Number(overview.data?.pendingHosts) > 0 && (
                  <em>{overview.data?.pendingHosts}</em>
                )}
                {key === "listings" &&
                  Number(overview.data?.pendingListings) > 0 && (
                    <em>{overview.data?.pendingListings}</em>
                  )}
              </button>
            </div>
          ))}
        </nav>
        <Link className="r-admin-site-link" to="/">
          View your website <ArrowUpRight size={16} />
        </Link>
        <div className="r-admin-identity">
          <span>{session?.user?.name?.charAt(0) || "A"}</span>
          <div>
            <b>{session?.user?.name || "Administrator"}</b>
            <small>Administrator</small>
          </div>
          <ShieldCheck size={17} />
        </div>
      </aside>
      <div className="r-admin-content">
        <header className="r-admin-heading">
          <div>
            <div className="r-admin-breadcrumb">
              Workspace <ChevronRight size={13} /> {currentSection.label}
            </div>
            <h1>
              {entity === "overview"
                ? `Welcome back, ${session?.user?.name?.split(" ")[0] || "Admin"}.`
                : currentSection.label}
            </h1>
            <p>
              {entity === "overview"
                ? "Here’s what’s happening with your marketplace today."
                : `View and manage your marketplace ${currentSection.label.toLowerCase()}.`}
            </p>
          </div>
          <div className="r-hosting-header-actions">
            {entity === "overview" && (
              <Link className="r-hosting-primary" to="/admin/listings">
                Manage listings <ArrowUpRight size={16} />
              </Link>
            )}
            <button className="r-secondary r-admin-refresh" onClick={refresh}>
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </header>
        {entity === "overview" ? (
          <>
            <Load {...overview} />
            <section className="r-admin-command">
              <div>
                <span className="r-admin-command-kicker">
                  OMSHIVRAJ · BUSINESS OVERVIEW
                </span>
                <h2>
                  Your stays.
                  <br />
                  <em>Your business, in view.</em>
                </h2>
                <p>
                  Manage your properties, look after your guests, and keep every
                  reservation moving.
                </p>
                <div className="r-admin-command-actions">
                  <Link to="/admin/listings">
                    Manage properties <ArrowUpRight size={16} />
                  </Link>
                  <Link to="/admin/bookings">
                    View reservations <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
              <div className="r-admin-command-summary">
                <House size={26} />
                <strong>{overview.data?.listings ?? "—"}</strong>
                <span>properties in your catalogue</span>
                <small>
                  <ShieldCheck size={14} /> Administrator access
                </small>
              </div>
            </section>
            <div className="r-admin-stats">
              {[
                {
                  key: "users",
                  label: "Total users",
                  icon: Users,
                  note: "Registered marketplace accounts",
                },
                {
                  key: "listings",
                  label: "Properties",
                  icon: House,
                  note: "All listings in your catalogue",
                },
                {
                  key: "bookings",
                  label: "Reservations",
                  icon: CalendarDays,
                  note: "Across all reservation statuses",
                },
                {
                  key: "paid",
                  label: "Online payments",
                  icon: CreditCard,
                  note: "Captured provider payments",
                },
              ].map(({ key, label, icon: Icon, note }) => (
                <article className={`r-admin-stat ${key}`} key={key}>
                  <div>
                    <span>{label}</span>
                    <i>
                      <Icon size={19} />
                    </i>
                  </div>
                  <h2>
                    {overview.data
                      ? key === "paid"
                        ? money(Number(overview.data[key]))
                        : overview.data[key]
                      : "—"}
                  </h2>
                  <p>{note}</p>
                  <Link
                    className="r-admin-stat-link"
                    to={`/admin/${key === "paid" ? "payments" : key}`}
                  >
                    View {key === "paid" ? "payments" : key}{" "}
                    <ArrowUpRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
            <div className="r-admin-review-strip">
              <div>
                <span className="r-admin-review-icon">
                  <ShieldCheck size={24} />
                </span>
                <div>
                  <h2>Your next steps</h2>
                  <p>Review new hosts and listings, all in one place.</p>
                </div>
              </div>
              <Link to="/admin/hosts">
                <b>{overview.data?.pendingHosts ?? "—"}</b>
                <span>Hosts to review</span>
                <ChevronRight size={17} />
              </Link>
              <Link to="/admin/listings">
                <b>{overview.data?.pendingListings ?? "—"}</b>
                <span>Listings to review</span>
                <ChevronRight size={17} />
              </Link>
            </div>
            <section className="r-admin-shortcuts" aria-label="Quick actions">
              {[
                {
                  to: "/admin/users",
                  title: "Guests & accounts",
                  copy: "Manage access and profiles",
                  icon: Users,
                },
                {
                  to: "/admin/payments",
                  title: "Payments & revenue",
                  copy: "Review payment records",
                  icon: CreditCard,
                },
                {
                  to: "/admin/coupons",
                  title: "Offers & coupons",
                  copy: "Manage your promotions",
                  icon: TicketPercent,
                },
                {
                  to: "/admin/settings",
                  title: "Website settings",
                  copy: "Update marketplace preferences",
                  icon: Settings2,
                },
              ].map(({ to, title, copy, icon: Icon }) => (
                <Link key={to} to={to}>
                  <Icon size={21} />
                  <span>
                    <b>{title}</b>
                    <small>{copy}</small>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              ))}
            </section>
            <section
              className="r-admin-service-status"
              aria-label="Guest service readiness"
            >
              <div>
                <ShieldCheck size={19} />
                <span>
                  <b>Guest services</b>
                  <small>Live configuration for your marketplace</small>
                </span>
              </div>
              <p>
                <span
                  className={session?.emailConfigured ? "ready" : "pending"}
                />
                Email{" "}
                {session?.emailConfigured ? "configured" : "setup required"}
              </p>
              <p>
                <span
                  className={session?.paymentsConfigured ? "ready" : "pending"}
                />
                Online payments{" "}
                {session?.paymentsConfigured ? "configured" : "setup required"}
              </p>
            </section>
            <div className="r-admin-overview-panels">
              <section className="r-admin-card">
                <div className="r-admin-card-heading">
                  <div>
                    <h2>Your reservations</h2>
                    <p>Updates from your 30 most recent reservations.</p>
                  </div>
                  <Link to="/admin/bookings">
                    View all <ArrowUpRight size={15} />
                  </Link>
                </div>
                <div
                  className="r-hosting-reservation-tabs"
                  aria-label="Reservation status"
                >
                  {[
                    { key: "ALL", label: "All" },
                    { key: "PENDING", label: "Requests" },
                    { key: "CONFIRMED", label: "Confirmed" },
                    { key: "CANCELLED", label: "Cancelled" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      aria-pressed={reservationFilter === tab.key}
                      onClick={() => setReservationFilter(tab.key)}
                    >
                      {tab.label}
                      <span>
                        {
                          (recent.data?.items || []).filter(
                            (row) => tab.key === "ALL" || row.status === tab.key
                          ).length
                        }
                      </span>
                    </button>
                  ))}
                </div>
                <Load {...recent} />
                {reservationItems.length ? (
                  <div className="r-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Reservation</th>
                          <th>Check-in</th>
                          <th>Status</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservationItems.slice(0, 5).map((row) => (
                          <tr key={String(row.id)}>
                            <td>
                              <Link to="/admin/bookings">
                                <strong>{String(row.reference)}</strong>
                              </Link>
                            </td>
                            <td>
                              <AdminValue field="checkIn" value={row.checkIn} />
                            </td>
                            <td>
                              <AdminValue field="status" value={row.status} />
                            </td>
                            <td>
                              <AdminValue field="total" value={row.total} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  !recent.loading &&
                  !recent.error && (
                    <div className="r-admin-empty">
                      <CalendarDays size={30} />
                      <h3>
                        {reservationFilter === "ALL"
                          ? "Room for new plans."
                          : "You’re all caught up."}
                      </h3>
                      <p>
                        {reservationFilter === "ALL"
                          ? "Reservations will appear here when guests book a stay."
                          : "No matching reservations in your recent activity."}
                      </p>
                    </div>
                  )
                )}
              </section>
              <section className="r-admin-card">
                <div className="r-admin-card-heading">
                  <div>
                    <h2>Recent activity</h2>
                    <p>A record of what’s changed.</p>
                  </div>
                  <Link to="/admin/audit">
                    <ArrowUpRight size={17} />
                    <span className="sr-only">View activity log</span>
                  </Link>
                </div>
                <Load {...activity} />
                <div className="r-admin-activity">
                  {activity.data?.items.slice(0, 5).map((row) => (
                    <div key={String(row.id)}>
                      <span>
                        <ScrollText size={15} />
                      </span>
                      <div>
                        <b>
                          {String(row.action)
                            .replaceAll("_", " ")
                            .toLowerCase()}
                        </b>
                        <small>{rentalDate(String(row.createdAt))}</small>
                      </div>
                    </div>
                  ))}
                  {!activity.loading &&
                    !activity.error &&
                    !activity.data?.items.length && (
                      <p>No activity recorded yet.</p>
                    )}
                </div>
              </section>
            </div>
            <section className="r-hosting-featured">
              <div className="r-admin-card-heading">
                <div>
                  <h2>Make every stay stand out</h2>
                  <p>A fresh look at your published listings.</p>
                </div>
                <Link to="/admin/listings">
                  Manage all listings <ArrowUpRight size={16} />
                </Link>
              </div>
              <Load {...highlights} />
              <div className="r-hosting-listing-grid">
                {highlights.data?.items.slice(0, 3).map((property) => (
                  <Link
                    key={property.id}
                    to="/admin/listings"
                    className="r-hosting-listing-card"
                  >
                    <div>
                      <img
                        src={property.images[0] || "/gallery/photo-01.jpg"}
                        alt={property.title}
                        loading="lazy"
                      />
                      <span>
                        {property.demo ? "Demo listing" : "Published"}
                      </span>
                    </div>
                    <h3>{property.title}</h3>
                    <p>
                      {property.type} in {property.city} · {property.capacity}{" "}
                      guests
                    </p>
                    <span>
                      Manage listing <ArrowUpRight size={15} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="r-admin-records">
            <div className="r-admin-toolbar">
              {entity !== "settings" && (
                <label className="r-input-label">
                  Search {entity}
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </label>
              )}
              <button
                className="r-secondary"
                onClick={exportRows}
                disabled={!items.length}
              >
                <Download size={15} /> Export this page
              </button>
            </div>
            <Load {...q} />
            {!q.loading && !q.error && !items.length && (
              <p role="status">
                No {entity} found{search ? " for this search" : " yet"}.
              </p>
            )}
            <div className="r-table-wrap">
              <table>
                <thead>
                  <tr>
                    {columns.map((k) => (
                      <th key={k}>{adminLabel(k)}</th>
                    ))}
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={String(r.id || r.key || i)}>
                      {columns.map((k) => (
                        <td key={k}>
                          <AdminValue field={k} value={r[k]} />
                        </td>
                      ))}
                      <td>
                        <button
                          className="r-text-button"
                          onClick={() => setSelected(r)}
                        >
                          Details / actions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="r-pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>
                Page {page} · {q.data?.total || 0} records
              </span>
              <button
                disabled={page * 30 >= (q.data?.total || 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
            {entity === "settings" && q.data && !q.loading && !q.error && (
              <Form
                key={JSON.stringify(items)}
                submit={async (f) =>
                  act("/admin/settings", Object.fromEntries(f), "PATCH")
                }
              >
                <Field
                  name="platformFeeBps"
                  label="Platform fee (basis points; 500 = 5%)"
                  type="number"
                  value={
                    (items.find((x) => x.key === "platformFeeBps")
                      ?.value as string) || "500"
                  }
                />
                <Field
                  name="taxBps"
                  label="Tax (basis points)"
                  type="number"
                  value={
                    (items.find((x) => x.key === "taxBps")?.value as string) ||
                    "0"
                  }
                />
                <Field
                  name="banner"
                  label="Site announcement"
                  required={false}
                  value={
                    (items.find((x) => x.key === "banner")?.value as string) ||
                    ""
                  }
                />
              </Form>
            )}
            {entity === "categories" && (
              <Form
                label="Add category"
                submit={async (f) =>
                  act("/admin/categories", { name: f.get("name") })
                }
              >
                <Field name="name" label="Category name" />
              </Form>
            )}
            {entity === "coupons" && (
              <Form
                label="Save coupon"
                submit={async (f) =>
                  act("/admin/coupons", {
                    code: f.get("code"),
                    percent: Number(f.get("percent")),
                    expiresAt: new Date(
                      String(f.get("expiresAt"))
                    ).toISOString(),
                  })
                }
              >
                <Field name="code" label="Code (uppercase letters / numbers)" />
                <Field
                  name="percent"
                  label="Discount percent (1–50)"
                  type="number"
                />
                <Field name="expiresAt" label="Expiry" type="datetime-local" />
              </Form>
            )}
          </section>
        )}
        {selected && (
          <RentalDialog
            title={`Manage ${entity}`}
            close={() => setSelected(null)}
          >
            <dl className="r-record">
              {Object.entries(selected).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
            <div className="r-button-row">
              {entity === "listings" && (
                <Link
                  className="r-secondary"
                  to={`/host/listings/${selected.id}/edit`}
                >
                  Edit listing and photos
                </Link>
              )}
              {["hosts", "listings"].includes(entity) &&
                [true, false].map((approved) => (
                  <button
                    className={approved ? "r-primary" : "r-secondary"}
                    key={String(approved)}
                    onClick={() =>
                      act(
                        `/admin/${entity}/${selected.id || selected.userId}/decision`,
                        { approved }
                      ).catch((e) => notify(e.message))
                    }
                  >
                    {approved ? "Approve" : "Reject"}
                  </button>
                ))}
              {entity === "users" && (
                <Form
                  submit={async (f) =>
                    act(
                      `/admin/users/${selected.id}`,
                      { role: f.get("role"), active: f.get("active") === "on" },
                      "PATCH"
                    )
                  }
                >
                  <label className="r-input-label">
                    Role
                    <select name="role" defaultValue={String(selected.role)}>
                      {["GUEST", "HOST", "ADMIN"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label className="r-check">
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={Boolean(selected.active)}
                    />
                    Account active
                  </label>
                </Form>
              )}
              {entity === "reviews" && (
                <button
                  className="r-secondary"
                  onClick={() =>
                    act(
                      `/admin/reviews/${selected.id}`,
                      { visible: !selected.visible },
                      "PATCH"
                    ).catch((e) => notify(e.message))
                  }
                >
                  {selected.visible ? "Hide review" : "Restore review"}
                </button>
              )}
              {entity === "reports" &&
                ["RESOLVED", "DISMISSED", "OPEN"].map((status) => (
                  <button
                    className="r-secondary"
                    key={status}
                    onClick={() =>
                      act(
                        `/admin/reports/${selected.id}`,
                        { status },
                        "PATCH"
                      ).catch((e) => notify(e.message))
                    }
                  >
                    {status}
                  </button>
                ))}
              {entity === "categories" && (
                <button
                  className="r-secondary"
                  onClick={() =>
                    act(
                      `/admin/categories/${encodeURIComponent(String(selected.name))}`,
                      { active: !selected.active },
                      "PATCH"
                    ).catch((e) => notify(e.message))
                  }
                >
                  {selected.active ? "Disable" : "Enable"}
                </button>
              )}
              {entity === "coupons" && (
                <>
                  <Form
                    label="Update coupon"
                    submit={async (f) =>
                      act("/admin/coupons", {
                        code: selected.code,
                        percent: Number(f.get("percent")),
                        expiresAt: new Date(
                          String(f.get("expiresAt"))
                        ).toISOString(),
                      })
                    }
                  >
                    <Field
                      name="percent"
                      label="Discount percent (1–50)"
                      type="number"
                      value={Number(selected.percent)}
                    />
                    <Field
                      name="expiresAt"
                      label="Expiry"
                      type="datetime-local"
                      value={(() => {
                        const expiry = new Date(String(selected.expiresAt))
                        return new Date(
                          expiry.getTime() - expiry.getTimezoneOffset() * 60000
                        )
                          .toISOString()
                          .slice(0, 16)
                      })()}
                    />
                  </Form>
                  <button
                    className="r-secondary"
                    onClick={() =>
                      act(
                        `/admin/coupons/${encodeURIComponent(String(selected.code))}`,
                        { active: !selected.active },
                        "PATCH"
                      ).catch((e) => notify(e.message))
                    }
                  >
                    {selected.active ? "Disable coupon" : "Enable coupon"}
                  </button>
                </>
              )}
              {entity === "bookings" &&
                ["PENDING", "CONFIRMED"].includes(String(selected.status)) && (
                  <Form
                    label="Cancel reservation"
                    submit={async () =>
                      act(`/bookings/${selected.id}/cancel`, {})
                    }
                  >
                    <p>
                      Cancel this reservation and record an eligible refund for
                      provider processing.
                    </p>
                  </Form>
                )}
              {entity === "refunds" && selected.status === "PENDING" && (
                <button
                  className="r-primary"
                  onClick={() =>
                    act(`/admin/refunds/${selected.id}/process`, {}).catch(
                      (e) => notify(e.message)
                    )
                  }
                >
                  Process refund through Razorpay
                </button>
              )}
            </div>
          </RentalDialog>
        )}
      </div>
    </div>
  )
}
function Info({ path }: { path: string }) {
  const details: Record<string, [string, string]> = {
    "/help": [
      "A little help goes a long way.",
      "Search a destination, choose dates and guests, then request a stay. Your Trips page shows the live reservation status. For questions about a property, use “Contact host” on the stay page.",
    ],
    "/contact": [
      "Let’s get you sorted.",
      "For property questions, contact your host through private messages. For marketplace support, send a report below.",
    ],
    "/terms": [
      "Clear expectations. Better stays.",
      "Review the property details, dates, total price, house rules, and cancellation policy before requesting a stay. Host-approved requests require explicit host confirmation. Your Trips page shows your reservation status. For pay-at-property stays, payment is due at the property. Online payments are confirmed only after the payment provider verifies receipt. Hosts must provide accurate accommodation information and availability.",
    ],
    "/privacy": [
      "Your plans are personal.",
      "We store your account details, bookings, messages and preferences to operate the marketplace. Passwords are hashed, sessions are protected, and payment card details are handled by the payment provider. Contact support for account data requests.",
    ],
    "/cancellation-policy": [
      "Plans change. Here’s what happens.",
      "Flexible: full refund at least 24 hours before arrival, then 50% before arrival. Moderate: full refund at least 5 days before arrival, then 50%. Strict: 50% at least 7 days before arrival, otherwise none. No refund after check-in. Pay-at-property bookings have no online payment to refund. Check each stay’s policy before requesting.",
    ],
    "/experiences": [
      "Good things take a little time.",
      "Local experiences are planned for a later phase. For now, discover a place to stay and make your own adventure.",
    ],
  }
  const [title, body] = details[path] || details["/help"]
  return (
    <div className="r-info-page">
      <div className="r-info-hero">
        <div>
          <span className="r-kicker">OMSHIVRAJ · HERE FOR YOU</span>
          <h1>{title}</h1>
          <p>{body}</p>
        </div>
        <img
          src="/gallery/photo-08.jpg"
          alt="A comfortable bedroom with a welcoming seating area"
        />
      </div>
      {["/help", "/contact"].includes(path) && (
        <div className="r-panel">
          <h2>Call Omshivraj</h2>
          <p>Speak with us about your stay or get help with a booking.</p>
          <a className="r-primary" href={rentalContact.callUrl}>
            Call {rentalContact.phone}
          </a>
        </div>
      )}
      {["/help", "/contact"].includes(path) && (
        <nav className="r-help-links" aria-label="Support topics">
          <Link to="/trips">
            <CalendarDays size={23} />
            <h2>Your reservations</h2>
            <p>View your trips and manage a booking.</p>
            <ArrowUpRight size={17} />
          </Link>
          <Link to="/messages">
            <Users size={23} />
            <h2>Talk to your host</h2>
            <p>Keep your stay details in one conversation.</p>
            <ArrowUpRight size={17} />
          </Link>
          <Link to="/cancellation-policy">
            <ShieldCheck size={23} />
            <h2>Plans have changed?</h2>
            <p>Understand cancellation and refund policies.</p>
            <ArrowUpRight size={17} />
          </Link>
        </nav>
      )}
      {path === "/contact" ? (
        <Guard>
          <Form
            label="Send support report"
            submit={async (f) =>
              rentalRequest("/reports", {
                targetId: "support",
                body: f.get("body"),
              })
            }
          >
            <label className="r-input-label">
              How can we help?
              <textarea name="body" required maxLength={3000} />
            </label>
          </Form>
        </Guard>
      ) : (
        <Link className="r-primary" to="/search">
          Explore stays
        </Link>
      )}
    </div>
  )
}
export function RentalWorkspace() {
  const { pathname, search } = useLocation(),
    [params] = useSearchParams()
  void params
  if (
    [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
    ].includes(pathname)
  )
    return <Auth key={`${pathname}${search}`} />
  if (pathname === "/host") return <HostIntro />
  if (
    [
      "/help",
      "/contact",
      "/terms",
      "/privacy",
      "/cancellation-policy",
      "/experiences",
    ].includes(pathname)
  )
    return (
      <div className="r-container">
        <Info path={pathname} />
      </div>
    )
  const host = pathname.startsWith("/host/"),
    admin = pathname.startsWith("/admin")
  const title = admin
    ? "Your marketplace, at a glance."
    : host
      ? "A little hosting. A lot of possibility."
      : {
          "/profile": "Your account.",
          "/wishlists": "Places you’re dreaming of.",
          "/trips": "Your next chapter.",
          "/messages": "Good conversations start here.",
          "/notifications": "A little heads-up.",
        }[pathname] || "Your workspace."
  const preview = pathname.match(/^\/host\/listings\/([^/]+)\/preview$/)
  const edit = pathname.match(/^\/host\/listings\/([^/]+)\/edit$/)
  return (
    <div
      className={
        admin
          ? "r-container r-workspace r-admin-workspace"
          : "r-container r-workspace"
      }
    >
      <Guard roles={admin ? ["ADMIN"] : host ? ["HOST", "ADMIN"] : undefined}>
        {!admin && (
          <>
            <span className="r-kicker">
              {admin
                ? "OMSHIVRAJ ADMIN"
                : host
                  ? "HOST WORKSPACE"
                  : "AT HOME WITH OMSHIVRAJ"}
            </span>
            <h1>{title}</h1>
            <p className="r-workspace-description">
              {host
                ? "Everything you need to create a welcoming stay, in one place."
                : {
                    "/profile":
                      "Your details, preferences and a little peace of mind.",
                    "/wishlists":
                      "Keep your favourite places close. Your next escape starts here.",
                    "/trips":
                      "All your plans, from the first request to the journey home.",
                    "/messages":
                      "A direct connection with the people behind your stay.",
                    "/notifications":
                      "The latest updates about your account and reservations.",
                  }[pathname]}
            </p>
          </>
        )}
        {host && <HostNav />}
        {!host && !admin && (
          <nav
            className="r-workspace-nav r-guest-nav"
            aria-label="Account navigation"
          >
            {[
              { path: "/profile", label: "Profile" },
              { path: "/wishlists", label: "Wishlists" },
              { path: "/trips", label: "Trips" },
              { path: "/messages", label: "Messages" },
              { path: "/notifications", label: "Notifications" },
            ].map((item) => (
              <NavLink key={item.path} to={item.path}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
        {admin ? (
          <Admin />
        ) : pathname === "/profile" ? (
          <Profile />
        ) : pathname === "/wishlists" ? (
          <Wishlists />
        ) : pathname === "/trips" ? (
          <Trips />
        ) : pathname === "/messages" ? (
          <Messages />
        ) : pathname === "/notifications" ? (
          <Notifications />
        ) : pathname === "/host/listings/new" ? (
          <ListingEditor />
        ) : edit ? (
          <ListingEditor key={edit[1]} id={edit[1]} />
        ) : preview ? (
          <ListingPreview id={preview[1]} />
        ) : pathname === "/host/reviews" ? (
          <HostReviews />
        ) : pathname === "/host/calendar" ? (
          <Calendar />
        ) : pathname === "/host/reservations" ? (
          <Trips host />
        ) : pathname === "/host/earnings" ? (
          <Earnings />
        ) : host ? (
          <HostListings />
        ) : (
          <Info path="/help" />
        )}
      </Guard>
    </div>
  )
}
