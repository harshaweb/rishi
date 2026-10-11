import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import {
  ArrowUpRight,
  LayoutDashboard,
  Inbox,
  BriefcaseBusiness,
  BookOpen,
  Layers3,
  Building2,
  FolderKanban,
  Users,
  Settings2,
  Image,
  ShieldCheck,
  LogOut,
  Plus,
  Search,
  X,
  Download,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Mail,
  FileText,
  Tags,
  HelpCircle,
  Check,
  Menu,
} from "lucide-react"
import { api, ApiError, getAuthSession } from "../lib/api"
import { useContent } from "../lib/content"
import { Logo } from "../components/layout"
import { SafeMarkdown } from "./public"
import { sectionDefinitions, type SectionCopy } from "../../shared/sections"

type User = { id: string; name: string; email: string; role: "ADMIN" | "STAFF" }
type Session = { user: User | null; csrf: string }
type Row = Record<string, unknown> & { id: string }
type Listing = { items: Row[]; total: number; page: number; pageSize: number }
type Field = {
  key: string
  label: string
  type?:
    | "textarea"
    | "markdown"
    | "list"
    | "boolean"
    | "date"
    | "number"
    | "select"
    | "email"
    | "password"
    | "media"
    | "multiselect"
  options?: string[]
  optional?: boolean
  relation?: "services" | "industries" | "categories" | "tags"
  default?: unknown
}
const publish: Field[] = [
  { key: "published", label: "Published", type: "boolean" },
  { key: "order", label: "Display order", type: "number", default: 0 },
]
const seo: Field[] = [
  { key: "seoTitle", label: "SEO title (optional)", optional: true },
  {
    key: "seoDescription",
    label: "SEO description (optional)",
    type: "textarea",
    optional: true,
  },
]
const base: Field[] = [
  { key: "title", label: "Title" },
  { key: "slug", label: "URL slug" },
  { key: "description", label: "Short description", type: "textarea" },
  { key: "body", label: "Content (Markdown)", type: "markdown" },
]
const configs: Record<
  string,
  { title: string; description: string; fields: Field[] }
> = {
  services: {
    title: "Services",
    description: "Manage service pages, benefits and delivery approach.",
    fields: [
      ...base,
      { key: "headline", label: "Page headline" },
      { key: "category", label: "Category" },
      { key: "benefits", label: "Benefits — one per line", type: "list" },
      { key: "process", label: "Process steps — one per line", type: "list" },
      ...publish,
      ...seo,
    ],
  },
  industries: {
    title: "Industries",
    description: "Keep industry-specific pages relevant and useful.",
    fields: [
      ...base,
      { key: "benefits", label: "Capabilities — one per line", type: "list" },
      ...publish,
      ...seo,
    ],
  },
  projects: {
    title: "Portfolio",
    description:
      "Publish project studies. Keep demonstration projects labelled accurately.",
    fields: [
      ...base,
      { key: "industry", label: "Industry label" },
      {
        key: "industryId",
        label: "Related industry",
        type: "select",
        relation: "industries",
        optional: true,
      },
      {
        key: "services",
        label: "Services provided — one per line",
        type: "list",
      },
      {
        key: "serviceIds",
        label: "Related services",
        type: "multiselect",
        relation: "services",
        optional: true,
      },
      {
        key: "technologies",
        label: "Technologies — one per line",
        type: "list",
      },
      {
        key: "cover",
        label: "Cover illustration or uploaded media path",
        type: "media",
        default: "commerce",
      },
      {
        key: "gallery",
        label: "Gallery media paths — one per line",
        type: "list",
        optional: true,
      },
      {
        key: "demo",
        label: "Demonstration concept",
        type: "boolean",
        default: true,
      },
      { key: "url", label: "Public project URL", optional: true },
      {
        key: "results",
        label: "Verified results only",
        type: "textarea",
        optional: true,
      },
      ...publish,
      ...seo,
    ],
  },
  posts: {
    title: "Articles",
    description:
      "Write, preview and publish original articles. A future publication date schedules visibility.",
    fields: [
      ...base,
      {
        key: "categoryId",
        label: "Category",
        type: "select",
        relation: "categories",
        optional: true,
      },
      {
        key: "tagIds",
        label: "Tags",
        type: "multiselect",
        relation: "tags",
        optional: true,
      },
      {
        key: "cover",
        label: "Cover illustration or uploaded media path",
        type: "media",
        default: "strategy",
      },
      {
        key: "status",
        label: "Publication status",
        type: "select",
        options: ["DRAFT", "PUBLISHED"],
        default: "DRAFT",
      },
      {
        key: "publishedAt",
        label: "Publication time (your local time)",
        type: "date",
        optional: true,
      },
      { key: "featured", label: "Featured article", type: "boolean" },
      ...seo,
    ],
  },
  categories: {
    title: "Categories",
    description: "Organise the resource library.",
    fields: [
      { key: "title", label: "Category name" },
      { key: "slug", label: "URL slug" },
    ],
  },
  tags: {
    title: "Tags",
    description: "Help visitors discover related perspectives.",
    fields: [
      { key: "title", label: "Tag name" },
      { key: "slug", label: "URL slug" },
    ],
  },
  faqs: {
    title: "FAQs",
    description: "Answer real questions across the homepage and service pages.",
    fields: [
      { key: "question", label: "Question" },
      { key: "answer", label: "Answer", type: "textarea" },
      {
        key: "serviceId",
        label: "Service (leave empty for homepage)",
        type: "select",
        relation: "services",
        optional: true,
      },
      ...publish,
    ],
  },
  team: {
    title: "Team profiles",
    description:
      "Publish only verified team information and approved photographs.",
    fields: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "bio", label: "Biography", type: "textarea" },
      {
        key: "photo",
        label: "Uploaded photo path",
        type: "media",
        optional: true,
      },
      ...publish,
    ],
  },
  jobs: {
    title: "Career opportunities",
    description: "Publish current positions and manage role descriptions.",
    fields: [
      ...base,
      { key: "location", label: "Location / remote policy" },
      { key: "type", label: "Employment type" },
      { key: "published", label: "Published", type: "boolean" },
    ],
  },
  users: {
    title: "Staff & access",
    description:
      "Create authorised staff accounts. Disable an account to immediately block access.",
    fields: [
      { key: "name", label: "Full name" },
      { key: "email", label: "Email address", type: "email" },
      {
        key: "role",
        label: "Access role",
        type: "select",
        options: ["STAFF", "ADMIN"],
        default: "STAFF",
      },
      {
        key: "active",
        label: "Account active",
        type: "boolean",
        default: true,
      },
      {
        key: "password",
        label: "Password (12–72 characters; leave blank to keep current)",
        type: "password",
        optional: true,
      },
    ],
  },
}
const navigation = [
  ["overview", "Overview", LayoutDashboard, false],
  ["leads", "Enquiries", Inbox, false],
  ["services", "Services", Layers3, false],
  ["industries", "Industries", Building2, false],
  ["projects", "Portfolio", FolderKanban, true],
  ["posts", "Articles", BookOpen, false],
  ["categories", "Categories", FolderKanban, false],
  ["tags", "Tags", Tags, false],
  ["faqs", "FAQs", HelpCircle, false],
  ["team", "Team", Users, true],
  ["jobs", "Careers", BriefcaseBusiness, true],
  ["applications", "Applications", FileText, false],
  ["subscribers", "Subscribers", Mail, false],
  ["media", "Media library", Image, true],
  ["sections", "Website sections", LayoutDashboard, true],
  ["settings", "Site settings", Settings2, true],
  ["users", "Staff & access", Users, true],
  ["audit", "Audit trail", ShieldCheck, true],
] as const
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`admin-dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
function Alert({ error }: { error: string }) {
  return error ? (
    <div className="error-box" role="alert">
      {error}
    </div>
  ) : null
}
function Pagination({
  listing,
  onPage,
}: {
  listing: Listing
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(listing.total / listing.pageSize))
  return (
    <div className="pagination">
      <span>
        {listing.total} records · Page {listing.page} of {pages}
      </span>
      <div>
        <button
          aria-label="Previous page"
          disabled={listing.page <= 1}
          onClick={() => onPage(listing.page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          aria-label="Next page"
          disabled={listing.page >= pages}
          onClick={() => onPage(listing.page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  )
}
const display = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v) : ""
const date = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—"
const statusLabel = (value: unknown) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()

export function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [mobile, setMobile] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const section = location.pathname.split("/")[2] || "overview"
  useEffect(() => {
    getAuthSession<Session>()
      .then(setSession)
      .catch((err) => setError(err.message))
  }, [])
  useEffect(() => {
    document.title = "Harshaweb — Staff workspace"
    // Navigation from the router closes the temporary mobile drawer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(false)
  }, [location.pathname])
  async function mutate<T = Record<string, unknown>>(
    path: string,
    method: string,
    data?: unknown
  ): Promise<T> {
    try {
      return await api<T>(path, {
        method,
        headers: { "X-CSRF-Token": session!.csrf },
        ...(data
          ? { body: data instanceof FormData ? data : JSON.stringify(data) }
          : {}),
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401)
        setSession({ user: null, csrf: session!.csrf })
      throw err
    }
  }
  if (!session || !session.user)
    return (
      <div className="admin-login">
        <div className="login-story">
          <Logo />
          <div>
            <span className="eyebrow">THE HARSHAWEB WORKSPACE</span>
            <h1>
              Good work.
              <br />
              Clear direction.
            </h1>
            <p>
              Your enquiries, content and conversations.
              <br />
              Connected in one place.
            </p>
          </div>
          <span>AUTHORISED STAFF ACCESS ONLY</span>
        </div>
        <div className="login-form-wrap">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError("")
              const data = new FormData(e.currentTarget)
              try {
                const result = await api<Session>("/api/auth/login", {
                  method: "POST",
                  headers: { "X-CSRF-Token": session!.csrf },
                  body: JSON.stringify({
                    email: data.get("email"),
                    password: data.get("password"),
                  }),
                })
                setSession(result)
                navigate("/admin")
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sign-in failed.")
              } finally {
                setBusy(false)
              }
            }}
          >
            <ShieldCheck className="login-shield" size={28} />
            <h2>Welcome back.</h2>
            <p>Sign in to your Harshaweb workspace.</p>
            <div className="field">
              <label htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Alert error={error} />
            <button
              type="submit"
              className="button"
              disabled={busy || !session}
            >
              {busy ? "Signing in…" : "Sign in securely"}
              <ArrowUpRight size={17} />
            </button>
            {!session && !error && (
              <p role="status">Connecting to the workspace…</p>
            )}
            <p className="login-help">
              Accounts are created by an administrator. Contact your site
              operator for access.
            </p>
            <Link className="text-link" to="/">
              ← Back to the website
            </Link>
          </form>
        </div>
      </div>
    )
  const canOpen =
    !navigation.find((n) => n[0] === section)?.[3] ||
    session.user.role === "ADMIN"
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobile ? "mobile-open" : ""}`}>
        <Logo />
        <span className="workspace-label">BUSINESS WORKSPACE</span>
        <nav aria-label="Admin navigation">
          {navigation
            .filter((n) => session.user!.role === "ADMIN" || !n[3])
            .map(([key, title, Icon]) => (
              <NavLink
                to={key === "overview" ? "/admin" : `/admin/${key}`}
                end
                key={key}
              >
                <Icon size={17} />
                {title}
              </NavLink>
            ))}
        </nav>
        <div className="admin-profile">
          <span>{session.user.name[0]}</span>
          <div>
            <b>{session.user.name}</b>
            <small>{session.user.role.toLowerCase()}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              setError("")
              try {
                await mutate("/api/auth/logout", "POST")
                setSession(await api<Session>("/api/auth/session"))
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not sign out."
                )
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="icon-button mobile-admin-toggle"
            aria-label="Toggle workspace navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <span>
            Workspace <span>/</span>{" "}
            {navigation.find((n) => n[0] === section)?.[1] || "Page not found"}
          </span>
          <Link to="/">
            View website
            <ArrowUpRight size={14} />
          </Link>
        </header>
        <main className="admin-content" id="main-content">
          <Alert error={error} />
          {!canOpen ? (
            <div className="empty-state">
              <ShieldCheck size={35} />
              <h1>Administrator access required.</h1>
            </div>
          ) : section === "overview" ? (
            <Overview role={session.user.role} />
          ) : section === "leads" ? (
            <LeadManager mutate={mutate} role={session.user.role} />
          ) : section === "settings" ? (
            <SettingsEditor mutate={mutate} />
          ) : section === "sections" ? (
            <SectionsEditor mutate={mutate} />
          ) : section === "media" ? (
            <MediaManager mutate={mutate} />
          ) : ["applications", "subscribers", "audit"].includes(section) ? (
            <Records
              section={section}
              mutate={mutate}
              role={session.user.role}
            />
          ) : configs[section] ? (
            <ContentManager
              key={section}
              section={section}
              mutate={mutate}
              role={session.user.role}
            />
          ) : (
            <div className="empty-state">
              <h1>Workspace page not found.</h1>
              <Link to="/admin">Return to overview</Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
type Mutate = <T = Record<string, unknown>>(
  path: string,
  method: string,
  data?: unknown
) => Promise<T>
function AdminHeading({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <span className="eyebrow">HARSHAWEB / WORKSPACE</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  )
}
function Overview({ role }: { role: User["role"] }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    api("/api/admin/metrics")
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])
  return (
    <>
      <AdminHeading
        title="A clear view of what’s next."
        description="Your website activity, based on actual saved records."
      />
      <Alert error={error} />
      {data ? (
        <>
          <div className="workspace-welcome">
            <div>
              <span className="workspace-kicker">
                <LayoutDashboard size={14} /> YOUR WEBSITE, AT A GLANCE
              </span>
              <h2>Make your next move.</h2>
              <p>
                Keep your content fresh, follow up on enquiries, and manage your
                business from one place.
              </p>
            </div>
            <Link
              className="button"
              to={role === "ADMIN" ? "/admin/sections" : "/admin/posts"}
            >
              {role === "ADMIN" ? "Manage website" : "Manage articles"}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="metric-grid">
            {[
              ["leads", "Total enquiries", Inbox],
              ["newLeads", "Awaiting a conversation", Mail],
              ["subscribers", "Active subscribers", Users],
              ["applications", "Career applications", BriefcaseBusiness],
            ].map(([key, label, Icon]) => {
              const I = Icon as typeof Inbox
              return (
                <div key={String(key)}>
                  <span>
                    {String(label)}
                    <span className={`metric-icon metric-${key}`}>
                      <I size={19} />
                    </span>
                  </span>
                  <strong>{display(data[String(key)])}</strong>
                  <small>Live database records</small>
                </div>
              )
            })}
          </div>
          <section className="admin-panel">
            <div className="panel-heading">
              <h2>Recent conversations</h2>
              <Link className="text-link" to="/admin/leads">
                All enquiries
                <ArrowUpRight size={15} />
              </Link>
            </div>
            {(data.recent as Row[]).length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recent as Row[]).map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link to={`/admin/leads?open=${row.id}`}>
                            <b>{display(row.name)}</b>
                            <small>{display(row.company)}</small>
                          </Link>
                        </td>
                        <td>{display(row.service)}</td>
                        <td>
                          <span
                            className={`status status-${statusLabel(row.status)}`}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td>{date(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Inbox size={29} />
                <h3>Your next conversation starts here.</h3>
                <p>New enquiries will appear when a visitor submits a form.</p>
                <Link to="/contact" className="text-link">
                  View enquiry form
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            )}
          </section>
          <div className="admin-quick-links">
            {role === "ADMIN" && (
              <Link to="/admin/sections">
                <LayoutDashboard />
                <h3>Website sections</h3>
                <p>Edit page headings, section content and visibility.</p>
                <ArrowUpRight size={18} />
              </Link>
            )}
            <Link to="/admin/posts">
              <BookOpen />
              <h3>Share a perspective</h3>
              <p>Create or refine an article for the resource library.</p>
              <ArrowUpRight size={18} />
            </Link>
            <Link to="/admin/services">
              <Layers3 />
              <h3>Keep your expertise current</h3>
              <p>Update service content and make your offering clear.</p>
              <ArrowUpRight size={18} />
            </Link>
            {role === "ADMIN" && (
              <Link to="/admin/settings">
                <Settings2 />
                <h3>Business details</h3>
                <p>Manage contact information, videos and social profiles.</p>
                <ArrowUpRight size={18} />
              </Link>
            )}
          </div>
        </>
      ) : (
        !error && <p role="status">Loading workspace…</p>
      )}
    </>
  )
}
function useListing(
  section: string,
  search: string,
  page: number,
  status = ""
) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState("")
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api<Listing>(
      `/api/admin/${section}?search=${encodeURIComponent(search)}&page=${page}&status=${encodeURIComponent(status)}`,
      { signal: controller.signal }
    )
      .then((result) => {
        setError("")
        setListing(result)
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message)
      })
    return () => controller.abort()
  }, [section, search, page, status, version])
  return { listing, error, reload: () => setVersion((v) => v + 1) }
}
function Toolbar({
  search,
  onSearch,
  children,
}: {
  search: string
  onSearch: (search: string) => void
  children?: ReactNode
}) {
  return (
    <div className="admin-toolbar">
      <div className="search-field">
        <Search size={16} />
        <label className="sr-only" htmlFor="admin-search">
          Search records
        </label>
        <input
          id="admin-search"
          placeholder="Search records…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {children}
    </div>
  )
}
function ContentManager({
  section,
  mutate,
  role,
}: {
  section: string
  mutate: Mutate
  role: string
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState<Row | "new" | null>(null)
  const [remove, setRemove] = useState<Row | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState("")
  const {
    listing,
    error: loadError,
    reload,
  } = useListing(section, search, page)
  const { refresh } = useContent()
  const config = configs[section]
  return (
    <>
      <AdminHeading title={config.title} description={config.description}>
        <button className="button" onClick={() => setEdit("new")}>
          <Plus size={16} />
          Add {section === "users" ? "staff member" : "new"}
        </button>
      </AdminHeading>
      <Alert error={loadError || error} />
      {success && (
        <p role="status" className="success-text">
          {success}
        </p>
      )}
      <section className="admin-panel">
        <Toolbar
          search={search}
          onSearch={(s) => {
            setSearch(s)
            setPage(1)
          }}
        />
        {listing ? (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      {section === "faqs"
                        ? "Question"
                        : section === "users" || section === "team"
                          ? "Name"
                          : "Title"}
                    </th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listing.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{display(row.title || row.question || row.name)}</b>
                        <small>{display(row.slug || row.email)}</small>
                      </td>
                      <td>
                        {display(
                          row.category ||
                            row.role ||
                            row.location ||
                            row.seoTitle
                        ) || "—"}
                      </td>
                      <td>
                        <span className="status">
                          {row.status
                            ? statusLabel(row.status)
                            : "published" in row
                              ? row.published
                                ? "published"
                                : "draft"
                              : "active" in row
                                ? row.active
                                  ? "active"
                                  : "disabled"
                                : "available"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${display(row.title || row.name || row.question)}`}
                            onClick={() => setEdit(row)}
                          >
                            <Pencil size={15} />
                          </button>
                          {role === "ADMIN" && section !== "users" && (
                            <button
                              className="icon-button danger"
                              aria-label={`Delete ${display(row.title || row.name || row.question)}`}
                              onClick={() => setRemove(row)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!listing.items.length && (
              <div className="empty-state">
                <Layers3 size={27} />
                <h3>No matching records.</h3>
                <p>Adjust your search or create a new record.</p>
              </div>
            )}
            <Pagination listing={listing} onPage={setPage} />
          </>
        ) : (
          !loadError && (
            <p className="loading-text" role="status">
              Loading records…
            </p>
          )
        )}
      </section>
      {edit && (
        <Editor
          section={section}
          record={edit === "new" ? null : edit}
          mutate={mutate}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null)
            setSuccess("Changes saved.")
            reload()
            void refresh()
          }}
        />
      )}
      {remove && (
        <Modal title="Delete this record?" onClose={() => setRemove(null)}>
          <p>
            This permanently deletes{" "}
            <strong>
              {display(remove.title || remove.name || remove.question)}
            </strong>
            . Review any related content before continuing.
          </p>
          <Alert error={error} />
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              onClick={() => setRemove(null)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                setError("")
                try {
                  await mutate(`/api/admin/${section}/${remove.id}`, "DELETE")
                  setRemove(null)
                  setSuccess("Record deleted.")
                  reload()
                  void refresh()
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Could not delete record."
                  )
                } finally {
                  setPending(false)
                }
              }}
            >
              Delete permanently
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
function Editor({
  section,
  record,
  mutate,
  onClose,
  onSaved,
}: {
  section: string
  record: Row | null
  mutate: Mutate
  onClose: () => void
  onSaved: () => void
}) {
  const config = configs[section]
  const { content } = useContent()
  const [data, setData] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [
        field.key,
        record?.[field.key] ??
          field.default ??
          (field.type === "boolean"
            ? false
            : ["list", "multiselect"].includes(field.type || "")
              ? []
              : field.type === "number"
                ? 0
                : ""),
      ])
    )
  )
  const [error, setError] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState(false)
  const [media, setMedia] = useState<Row[]>([])
  useEffect(() => {
    api<Listing>("/api/admin/media")
      .then((result) => setMedia(result.items))
      .catch((err) => {
        if (config.fields.some((field) => field.type === "media"))
          setError(
            err.status === 403
              ? "Media library access requires an administrator. You can still enter an existing uploaded media path."
              : err.message
          )
      })
  }, [config.fields])
  function update(key: string, value: unknown) {
    setData((d) => ({ ...d, [key]: value }))
  }
  function localDatetime(value: unknown) {
    if (!value) return ""
    const time = new Date(String(value))
    return new Date(time.getTime() - time.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
  }
  return (
    <Modal
      wide
      title={`${record ? "Edit" : "Create"} ${config.title.toLowerCase()}`}
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setPending(true)
          setError("")
          setFields({})
          const payload = { ...data }
          for (const field of config.fields)
            if (field.type === "list")
              payload[field.key] = (payload[field.key] as string[])
                .map((value) => value.trim())
                .filter(Boolean)
          if (section === "users" && !payload.password) delete payload.password
          if (section === "posts" && !payload.publishedAt)
            payload.publishedAt = null
          for (const field of config.fields)
            if (
              field.relation &&
              !payload[field.key] &&
              field.type !== "multiselect"
            )
              payload[field.key] = null
          try {
            await mutate(
              `/api/admin/${section}${record ? `/${record.id}` : ""}`,
              record ? "PATCH" : "POST",
              payload
            )
            onSaved()
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Could not save record."
            )
            if (err instanceof ApiError) setFields(err.fields)
          } finally {
            setPending(false)
          }
        }}
      >
        <div className="editor-fields">
          {config.fields.map((field) => (
            <div
              className={`field ${["textarea", "markdown", "list", "multiselect"].includes(field.type || "") ? "full-width" : ""}`}
              key={field.key}
            >
              {field.type === "boolean" ? (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={Boolean(data[field.key])}
                    onChange={(e) => update(field.key, e.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              ) : (
                <>
                  <label htmlFor={`editor-${field.key}`}>
                    {field.label}
                    {!field.optional && " *"}
                  </label>
                  {field.type === "select" ? (
                    <select
                      id={`editor-${field.key}`}
                      value={display(data[field.key])}
                      onChange={(e) => update(field.key, e.target.value)}
                      required={!field.optional}
                    >
                      <option value="">Choose…</option>
                      {field.relation
                        ? content[field.relation].map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.title}
                            </option>
                          ))
                        : field.options?.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                    </select>
                  ) : field.type === "multiselect" ? (
                    <div className="multi-options">
                      {field.relation &&
                        content[field.relation].map((option) => (
                          <label className="check-label" key={option.id}>
                            <input
                              type="checkbox"
                              checked={(data[field.key] as string[]).includes(
                                option.id
                              )}
                              onChange={(e) =>
                                update(
                                  field.key,
                                  e.target.checked
                                    ? [
                                        ...(data[field.key] as string[]),
                                        option.id,
                                      ]
                                    : (data[field.key] as string[]).filter(
                                        (id) => id !== option.id
                                      )
                                )
                              }
                            />
                            {option.title}
                          </label>
                        ))}
                    </div>
                  ) : ["textarea", "markdown", "list"].includes(
                      field.type || ""
                    ) ? (
                    <>
                      <textarea
                        id={`editor-${field.key}`}
                        rows={field.type === "markdown" ? 12 : 4}
                        value={
                          field.type === "list"
                            ? (data[field.key] as string[]).join("\n")
                            : display(data[field.key])
                        }
                        onChange={(e) =>
                          update(
                            field.key,
                            field.type === "list"
                              ? e.target.value.split("\n")
                              : e.target.value
                          )
                        }
                        required={!field.optional}
                      />
                      {field.type === "markdown" && (
                        <>
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => setPreview(!preview)}
                          >
                            {preview
                              ? "Hide preview"
                              : "Preview formatted content"}
                          </button>
                          {preview && (
                            <div className="markdown-preview">
                              <SafeMarkdown>
                                {display(data[field.key])}
                              </SafeMarkdown>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <input
                      id={`editor-${field.key}`}
                      type={
                        field.type === "date"
                          ? "datetime-local"
                          : field.type === "number"
                            ? "number"
                            : field.type === "password"
                              ? "password"
                              : field.type === "email"
                                ? "email"
                                : "text"
                      }
                      value={
                        field.type === "date"
                          ? localDatetime(data[field.key])
                          : display(data[field.key])
                      }
                      list={field.type === "media" ? "media-paths" : undefined}
                      autoComplete={
                        field.type === "password" ? "new-password" : undefined
                      }
                      required={
                        !field.optional ||
                        (section === "users" &&
                          field.key === "password" &&
                          !record)
                      }
                      minLength={field.type === "password" ? 12 : undefined}
                      maxLength={field.type === "password" ? 72 : undefined}
                      onChange={(e) =>
                        update(
                          field.key,
                          field.type === "number"
                            ? Number(e.target.value)
                            : field.type === "date"
                              ? e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null
                              : e.target.value
                        )
                      }
                    />
                  )}
                </>
              )}
              {fields[field.key] && (
                <span className="field-error">{fields[field.key]}</span>
              )}
            </div>
          ))}
        </div>
        <datalist id="media-paths">
          {media.map((asset) => (
            <option key={asset.id} value={display(asset.path)}>
              {display(asset.filename)}
            </option>
          ))}
          {[
            "commerce",
            "workspace",
            "education",
            "strategy",
            "design",
            "engineering",
          ].map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </datalist>
        <Alert error={error} />
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  )
}
function LeadManager({ mutate, role }: { mutate: Mutate; role: string }) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [open, setOpen] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("open")
  )
  const {
    listing,
    error: loadError,
    reload,
  } = useListing("leads", search, page, status)
  return (
    <>
      <AdminHeading
        title="Every conversation, in one place."
        description="Review enquiries, plan follow-ups and keep context with your team."
      >
        <button
          className="button button-secondary"
          onClick={async () => {
            setError("")
            try {
              const response = await fetch(
                `/api/admin/leads/export?search=${encodeURIComponent(search)}&status=${status}`
              )
              if (!response.ok)
                throw new Error("Export failed. Please sign in again or retry.")
              const url = URL.createObjectURL(await response.blob())
              const link = document.createElement("a")
              link.href = url
              link.download = "harshaweb-leads.csv"
              link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Export failed.")
            }
          }}
        >
          <Download size={16} />
          Export CSV
        </button>
      </AdminHeading>
      <Alert error={loadError || error} />
      <section className="admin-panel">
        <Toolbar
          search={search}
          onSearch={(s) => {
            setSearch(s)
            setPage(1)
          }}
        >
          <label className="sr-only" htmlFor="lead-status-filter">
            Filter by status
          </label>
          <select
            id="lead-status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "CLOSED"].map(
              (s) => (
                <option key={s}>{s}</option>
              )
            )}
          </select>
        </Toolbar>
        {listing ? (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Contact / reference</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Received</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {listing.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{display(row.name)}</b>
                        <small>
                          {display(row.company)} · {display(row.reference)}
                        </small>
                      </td>
                      <td>{display(row.service)}</td>
                      <td>
                        <span
                          className={`status status-${statusLabel(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td>{date(row.createdAt)}</td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Open enquiry from ${display(row.name)}`}
                          onClick={() => setOpen(row.id)}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!listing.items.length && (
              <div className="empty-state">
                <Inbox size={30} />
                <h3>No matching enquiries.</h3>
                <p>New submissions will appear here as they arrive.</p>
              </div>
            )}
            <Pagination listing={listing} onPage={setPage} />
          </>
        ) : (
          !loadError && <p className="loading-text">Loading enquiries…</p>
        )}
      </section>
      {open && (
        <LeadDetail
          id={open}
          mutate={mutate}
          role={role}
          onClose={() => {
            setOpen(null)
            reload()
          }}
        />
      )}
    </>
  )
}
function LeadDetail({
  id,
  mutate,
  onClose,
  role,
}: {
  id: string
  mutate: Mutate
  onClose: () => void
  role: string
}) {
  const [lead, setLead] = useState<Row | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const [remove, setRemove] = useState(false)
  const reload = useCallback(async () => {
    try {
      setLead(await api<Row>(`/api/admin/leads/${id}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load enquiry.")
    }
  }, [id])
  useEffect(() => {
    const controller = new AbortController()
    api<Row>(`/api/admin/leads/${id}`, { signal: controller.signal })
      .then(setLead)
      .catch((err) => {
        if (err.name !== "AbortError")
          setError(err.message || "Could not load enquiry.")
      })
    return () => controller.abort()
  }, [id])
  return (
    <Modal
      title={lead ? `Enquiry ${display(lead.reference)}` : "Loading enquiry"}
      wide
      onClose={onClose}
    >
      <Alert error={error} />
      {lead && (
        <>
          <div className="lead-detail-contact">
            <div>
              <h3>{display(lead.name)}</h3>
              <p>{display(lead.company)}</p>
            </div>
            <span className="status">{statusLabel(lead.status)}</span>
          </div>
          <dl className="lead-facts">
            {[
              "email",
              "phone",
              "website",
              "service",
              "budget",
              "timeline",
              "kind",
              "emailStatus",
            ].map((key) => (
              <div key={key}>
                <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                <dd>{display(lead[key]) || "—"}</dd>
              </div>
            ))}
          </dl>
          <h3>Project context</h3>
          <p className="preserve-lines">{display(lead.message)}</p>
          <form
            className="lead-status-form"
            onSubmit={async (e) => {
              e.preventDefault()
              setPending(true)
              setError("")
              const form = new FormData(e.currentTarget)
              try {
                const followUpAt = form.get("followUpAt")
                await mutate(`/api/admin/leads/${id}`, "PATCH", {
                  status: form.get("status"),
                  followUpAt: followUpAt
                    ? new Date(String(followUpAt)).toISOString()
                    : null,
                })
                await reload()
                setMessage("Follow-up details saved.")
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not update enquiry."
                )
              } finally {
                setPending(false)
              }
            }}
          >
            <div className="field">
              <label htmlFor="detail-status">Enquiry status</label>
              <select
                id="detail-status"
                name="status"
                defaultValue={display(lead.status)}
              >
                {[
                  "NEW",
                  "CONTACTED",
                  "QUALIFIED",
                  "PROPOSAL",
                  "WON",
                  "CLOSED",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="follow-up-date">Follow-up date</label>
              <input
                id="follow-up-date"
                name="followUpAt"
                type="date"
                defaultValue={
                  lead.followUpAt
                    ? new Date(String(lead.followUpAt))
                        .toISOString()
                        .slice(0, 10)
                    : ""
                }
              />
            </div>
            <button className="button" disabled={pending}>
              Save follow-up
            </button>
          </form>
          {message && (
            <p className="success-text" role="status">
              {message}
            </p>
          )}
          <h3>Team notes</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setPending(true)
              setError("")
              const form = e.currentTarget
              try {
                await mutate(`/api/admin/leads/${id}/notes`, "POST", {
                  body: new FormData(form).get("body"),
                })
                form.reset()
                await reload()
                setMessage("Note added.")
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not save note."
                )
              } finally {
                setPending(false)
              }
            }}
          >
            <div className="field">
              <label className="sr-only" htmlFor="lead-note">
                Add an internal note
              </label>
              <textarea
                name="body"
                id="lead-note"
                rows={3}
                placeholder="Keep the next conversation in context…"
                required
                maxLength={6000}
              />
            </div>
            <button className="button button-secondary" disabled={pending}>
              <Plus size={15} />
              Add note
            </button>
          </form>
          <div className="lead-notes">
            {(lead.notes as Row[]).map((note) => (
              <article key={note.id}>
                <p>{display(note.body)}</p>
                <small>
                  {display((note.user as { name: string }).name)} ·{" "}
                  {date(note.createdAt)}
                </small>
              </article>
            ))}
          </div>
          {role === "ADMIN" && (
            <div className="delete-section">
              {remove ? (
                <>
                  <p>
                    This will permanently delete this enquiry and all team
                    notes.
                  </p>
                  <div className="dialog-actions">
                    <button
                      className="button button-secondary"
                      onClick={() => setRemove(false)}
                    >
                      Keep enquiry
                    </button>
                    <button
                      className="button button-danger"
                      disabled={pending}
                      onClick={async () => {
                        setPending(true)
                        try {
                          await mutate(`/api/admin/leads/${id}`, "DELETE")
                          onClose()
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Delete failed."
                          )
                          setPending(false)
                        }
                      }}
                    >
                      Confirm permanent deletion
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="danger text-link"
                  onClick={() => setRemove(true)}
                >
                  <Trash2 size={15} />
                  Delete enquiry
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
function SectionsEditor({ mutate }: { mutate: Mutate }) {
  const [sections, setSections] = useState<Record<string, SectionCopy> | null>(
    null
  )
  const [selected, setSelected] = useState<string>(sectionDefinitions[0].id)
  const [draft, setDraft] = useState<SectionCopy>({})
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const { refresh } = useContent()
  useEffect(() => {
    api<Record<string, SectionCopy>>("/api/admin/sections")
      .then((data) => {
        setSections(data)
        setDraft(data[sectionDefinitions[0].id] || {})
      })
      .catch((err) => setError(err.message))
  }, [])
  const definition = sectionDefinitions.find((item) => item.id === selected)!
  return (
    <>
      <AdminHeading
        title="Manage your website sections."
        description="Edit section headings and introductory text, hide content sections, or replace static company content with Markdown. Blank fields keep the original text. Services, portfolio, articles, FAQs, team and jobs have their own editors in the sidebar. Homepage hero and video settings are also available in Site settings."
      />
      <Alert error={error} />
      {sections && (
        <form
          className="admin-panel settings-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setPending(true)
            setError("")
            setMessage("")
            try {
              await mutate(
                `/api/admin/sections/${encodeURIComponent(selected)}`,
                "PATCH",
                draft
              )
              setSections({ ...sections, [selected]: draft })
              await refresh()
              setMessage("Section saved. Your website is updated.")
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not save section."
              )
            } finally {
              setPending(false)
            }
          }}
        >
          <div className="field">
            <label htmlFor="section-choice">Website section</label>
            <select
              id="section-choice"
              value={selected}
              disabled={pending}
              onChange={(event) => {
                setSelected(event.target.value)
                setDraft(sections[event.target.value] || {})
                setMessage("")
                setError("")
              }}
            >
              {sectionDefinitions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label.trim()}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="section-title">Heading or button label</label>
            <input
              id="section-title"
              value={draft.title || ""}
              maxLength={200}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder="Leave blank to use the original heading"
            />
          </div>
          {selected !== "header" && (
            <div className="field">
              <label htmlFor="section-description">Introductory text</label>
              <textarea
                id="section-description"
                rows={4}
                value={draft.description || ""}
                maxLength={2000}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                placeholder="Leave blank to use the original introduction"
              />
            </div>
          )}
          {definition.body && (
            <div className="field">
              <label htmlFor="section-body">
                Replacement content (Markdown, optional)
              </label>
              <p>
                Replaces this static section’s contents. Clear this field to
                restore its original layout.
              </p>
              <textarea
                id="section-body"
                rows={12}
                maxLength={20000}
                value={draft.body || ""}
                onChange={(event) =>
                  setDraft({ ...draft, body: event.target.value })
                }
              />
              <SafeMarkdown>{draft.body || ""}</SafeMarkdown>
            </div>
          )}
          {(selected.startsWith("home:") || selected.startsWith("page:")) && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.hidden || false}
                onChange={(event) =>
                  setDraft({ ...draft, hidden: event.target.checked })
                }
              />
              Hide this section on the website
            </label>
          )}
          <p className="muted">
            Heading and introduction overrides apply where the section contains
            those elements. Collection items, forms and links keep their
            existing functionality. Changes publish when you save.
          </p>
          <div className="admin-toolbar">
            <button className="button" disabled={pending}>
              {pending ? "Saving…" : "Save section"}
              <Check size={16} />
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={pending}
              onClick={() => {
                setDraft({})
                setMessage("Original content selected. Save to apply.")
              }}
            >
              Restore original content
            </button>
            <a
              className="text-link"
              href="/"
              target="_blank"
              rel="noopener noreferrer"
            >
              View website <ArrowUpRight size={16} />
            </a>
          </div>
          {message && (
            <p role="status" className="success-text">
              {message}
            </p>
          )}
        </form>
      )}
    </>
  )
}
function SettingsEditor({ mutate }: { mutate: Mutate }) {
  const [data, setData] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const { refresh } = useContent()
  useEffect(() => {
    api<Record<string, string>>("/api/admin/settings")
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])
  const labels: Record<string, string> = {
    announcement: "Announcement bar",
    heroEyebrow: "Hero eyebrow",
    heroTitle: "Homepage headline",
    heroDescription: "Homepage description",
    contactEmail: "Verified contact email",
    contactPhone: "Verified contact phone",
    contactPhone2: "Additional verified phone 2 (with country code)",
    contactPhone2Hours: "Phone 2 contact hours",
    contactPhone3: "Additional verified phone 3 (with country code)",
    contactPhone3Hours: "Phone 3 contact hours",
    presenceLocations:
      "Verified presence locations — one per line (leave blank if unconfirmed)",
    vision: "Our vision",
    mission: "Our mission",
    whatsappPhone: "WhatsApp number with country code (leave blank to hide)",
    businessHours: "Business contact hours",
    bookingUrl: "Live booking calendar URL (optional HTTPS link)",
    linkedinUrl: "LinkedIn profile URL",
    instagramUrl: "Instagram profile URL",
    facebookUrl: "Facebook profile URL",
    youtubeUrl: "YouTube channel URL",
    video1Title: "Video 1 — title",
    video1Url: "Video 1 — YouTube, Vimeo or local video path",
    video1Description: "Video 1 — description",
    video1Transcript: "Video 1 — text transcript",
    video2Title: "Video 2 — title (optional)",
    video2Url: "Video 2 — YouTube, Vimeo or local video path",
    video2Description: "Video 2 — description",
    video2Transcript: "Video 2 — text transcript",
    video3Title: "Video 3 — title (optional)",
    video3Url: "Video 3 — YouTube, Vimeo or local video path",
    video3Description: "Video 3 — description",
    video3Transcript: "Video 3 — text transcript",
    address: "Verified business address",
    companyDescription: "Company description",
    maintenanceNotice: "Public service notice (leave blank to hide)",
  }
  return (
    <>
      <AdminHeading
        title="The details that make it yours."
        description="Manage your homepage, verified contact details, WhatsApp, booking calendar, social profiles and up to three videos. Leave optional links blank to hide them. External videos load only after a visitor clicks play."
      />
      <Alert error={error} />
      {data && (
        <form
          className="admin-panel settings-form"
          onSubmit={async (e) => {
            e.preventDefault()
            setPending(true)
            setMessage("")
            setError("")
            try {
              await mutate(
                "/api/admin/settings",
                "PATCH",
                Object.fromEntries(
                  Object.entries(data).filter(
                    ([key]) => key !== "sectionContent"
                  )
                )
              )
              await refresh()
              setMessage("Site settings saved.")
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not save settings."
              )
            } finally {
              setPending(false)
            }
          }}
        >
          {Object.entries(data)
            .filter(([key]) => key !== "sectionContent")
            .map(([key, value]) => (
              <div className="field" key={key}>
                <label htmlFor={`setting-${key}`}>{labels[key] || key}</label>
                {key.includes("Description") ||
                ["presenceLocations", "vision", "mission"].includes(key) ||
                key.endsWith("Transcript") ||
                key === "address" ? (
                  <textarea
                    id={`setting-${key}`}
                    value={value}
                    rows={3}
                    maxLength={3000}
                    onChange={(e) =>
                      setData({ ...data, [key]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    id={`setting-${key}`}
                    type={key === "contactEmail" ? "email" : "text"}
                    value={value}
                    maxLength={3000}
                    onChange={(e) =>
                      setData({ ...data, [key]: e.target.value })
                    }
                  />
                )}
              </div>
            ))}
          {message && (
            <p className="success-text" role="status">
              {message}
            </p>
          )}
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : "Save site settings"}
            <Check size={16} />
          </button>
        </form>
      )}
    </>
  )
}
function MediaManager({ mutate }: { mutate: Mutate }) {
  const [page, setPage] = useState(1)
  const { listing, error: loadError, reload } = useListing("media", "", page)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const [remove, setRemove] = useState<Row | null>(null)
  return (
    <>
      <AdminHeading
        title="A library with a purpose."
        description="Upload original or approved images. PNG, JPEG or WebP, up to 4 MB."
      />
      <Alert error={loadError || error} />
      <form
        className="admin-panel media-upload"
        onSubmit={async (e) => {
          e.preventDefault()
          setPending(true)
          setError("")
          setMessage("")
          const form = e.currentTarget
          try {
            const asset = await mutate<Row>(
              "/api/admin/media",
              "POST",
              new FormData(form)
            )
            setMessage(
              `Image saved. Use ${display(asset.path)} in your content.`
            )
            form.reset()
            reload()
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed.")
          } finally {
            setPending(false)
          }
        }}
      >
        <div className="field">
          <label htmlFor="media-image">Image file</label>
          <input
            name="image"
            id="media-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="media-alt">Descriptive alternative text</label>
          <input
            name="alt"
            id="media-alt"
            required
            minLength={3}
            maxLength={300}
          />
        </div>
        <button className="button" disabled={pending}>
          {pending ? "Uploading…" : "Upload image"}
          <Plus size={16} />
        </button>
      </form>
      {message && (
        <p className="success-text" role="status">
          {message}
        </p>
      )}
      {listing && (
        <>
          <div className="media-grid">
            {listing.items.map((asset) => (
              <article key={asset.id}>
                <img
                  src={display(asset.path)}
                  alt={display(asset.alt)}
                  loading="lazy"
                />
                <div>
                  <b>{display(asset.filename)}</b>
                  <p>{display(asset.alt)}</p>
                  <input
                    readOnly
                    value={display(asset.path)}
                    aria-label="Media path"
                    onFocus={(e) => e.target.select()}
                  />
                  <div className="table-actions">
                    <a
                      className="text-link"
                      href={`/api/admin/media/${asset.id}/file`}
                    >
                      Download
                      <Download size={14} />
                    </a>
                    <button
                      className="icon-button danger"
                      aria-label={`Delete ${display(asset.filename)}`}
                      onClick={() => setRemove(asset)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!listing.items.length && (
            <div className="empty-state">
              <Image size={30} />
              <h3>Your library is ready for its first image.</h3>
            </div>
          )}
          <Pagination listing={listing} onPage={setPage} />
        </>
      )}
      {remove && (
        <Modal title="Delete image?" onClose={() => setRemove(null)}>
          <p>
            This permanently removes the image. Images used in content must be
            unlinked first.
          </p>
          <Alert error={error} />
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              onClick={() => setRemove(null)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                setError("")
                try {
                  await mutate(`/api/admin/media/${remove.id}`, "DELETE")
                  setRemove(null)
                  reload()
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Could not delete image."
                  )
                } finally {
                  setPending(false)
                }
              }}
            >
              Delete image
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
function Records({
  section,
  mutate,
  role,
}: {
  section: string
  mutate: Mutate
  role: string
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const {
    listing,
    error: loadError,
    reload,
  } = useListing(section, search, page)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<Row | null>(null)
  const [remove, setRemove] = useState<Row | null>(null)
  const [pending, setPending] = useState(false)
  const title =
    section === "applications"
      ? "Career conversations."
      : section === "subscribers"
        ? "Your newsletter community."
        : "An accountable workspace."
  return (
    <>
      <AdminHeading
        title={title}
        description={
          section === "audit"
            ? "Recorded staff actions, ordered from most recent."
            : "Review real submissions and manage their status."
        }
      />
      <Alert error={loadError || error} />
      <section className="admin-panel">
        {section !== "audit" && (
          <Toolbar
            search={search}
            onSearch={(s) => {
              setSearch(s)
              setPage(1)
            }}
          />
        )}
        {listing && (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{section === "audit" ? "Action" : "Contact"}</th>
                    <th>{section === "audit" ? "Entity / staff" : "Status"}</th>
                    <th>Recorded</th>
                    {section !== "audit" && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {listing.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{display(row.name || row.email || row.action)}</b>
                        <small>
                          {display(
                            row.name
                              ? row.email
                              : section === "audit"
                                ? row.recordId
                                : ""
                          )}
                        </small>
                      </td>
                      <td>
                        {section === "audit" ? (
                          `${display(row.entity)} · ${display((row.user as { name?: string } | null)?.name) || "System"}`
                        ) : (
                          <span className="status">
                            {section === "subscribers"
                              ? row.active
                                ? "subscribed"
                                : "inactive"
                              : statusLabel(row.status)}
                          </span>
                        )}
                      </td>
                      <td>{date(row.createdAt)}</td>
                      {section !== "audit" && (
                        <td>
                          <div className="table-actions">
                            {section === "applications" ? (
                              <button
                                className="icon-button"
                                aria-label={`Review ${display(row.name)}`}
                                onClick={() => setDetail(row)}
                              >
                                <ArrowUpRight size={17} />
                              </button>
                            ) : row.active ? (
                              <button
                                className="text-link"
                                onClick={async () => {
                                  try {
                                    await mutate(
                                      `/api/admin/subscribers/${row.id}`,
                                      "PATCH",
                                      { active: false }
                                    )
                                    reload()
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "Could not unsubscribe record."
                                    )
                                  }
                                }}
                              >
                                Unsubscribe
                              </button>
                            ) : null}
                            {role === "ADMIN" && (
                              <button
                                className="icon-button danger"
                                aria-label="Delete record"
                                onClick={() => setRemove(row)}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!listing.items.length && (
              <div className="empty-state">
                <Inbox size={28} />
                <h3>No records to show yet.</h3>
              </div>
            )}
            <Pagination listing={listing} onPage={setPage} />
          </>
        )}
      </section>
      {detail && (
        <Modal title={display(detail.name)} onClose={() => setDetail(null)}>
          <p>{display(detail.email)}</p>
          <p>
            Interest:{" "}
            {display((detail.job as { title: string } | null)?.title) ||
              "General expression of interest"}
          </p>
          <p className="preserve-lines">{display(detail.message)}</p>
          {detail.portfolio ? (
            <a
              className="text-link"
              href={display(detail.portfolio)}
              rel="noopener noreferrer"
              target="_blank"
            >
              View portfolio
              <ArrowUpRight size={14} />
            </a>
          ) : null}
          {detail.resumeId ? (
            <a
              className="button button-secondary"
              href={`/api/admin/media/${detail.resumeId}/file`}
            >
              Download résumé
              <Download size={15} />
            </a>
          ) : null}
          <div className="field">
            <label htmlFor="application-status">Application status</label>
            <select
              id="application-status"
              value={display(detail.status)}
              onChange={async (e) => {
                const value = e.target.value
                try {
                  await mutate(
                    `/api/admin/applications/${detail.id}`,
                    "PATCH",
                    { status: value }
                  )
                  setDetail({ ...detail, status: value })
                  reload()
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Could not update application."
                  )
                }
              }}
            >
              {["NEW", "REVIEWING", "CONTACTED", "CLOSED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <Alert error={error} />
        </Modal>
      )}
      {remove && (
        <Modal
          title="Permanently delete this record?"
          onClose={() => setRemove(null)}
        >
          <p>
            This removes the submitted record
            {section === "applications" ? " and its attached résumé" : ""}.
          </p>
          <Alert error={error} />
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              onClick={() => setRemove(null)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                setError("")
                try {
                  await mutate(`/api/admin/${section}/${remove.id}`, "DELETE")
                  setRemove(null)
                  reload()
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Could not delete record."
                  )
                } finally {
                  setPending(false)
                }
              }}
            >
              Delete permanently
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
