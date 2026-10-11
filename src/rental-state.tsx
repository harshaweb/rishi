import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { api } from "./lib/api"
import type { RentalProperty, RentalUser } from "../shared/rentals"
type RentalSession = {
  user: RentalUser | null
  csrf: string
  paymentsConfigured: boolean
  mapsToken: string
  emailConfigured: boolean
}
let bootstrap: Promise<RentalSession> | undefined
export function rentalSession() {
  return (bootstrap ||= api<RentalSession>("/api/rental/session").finally(
    () => {
      bootstrap = undefined
    }
  ))
}
export async function rentalRequest<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method = "POST",
  csrf?: string
) {
  const token = csrf || (await rentalSession()).csrf
  return api<T>(`/api/rental${path}`, {
    method,
    headers: { "X-CSRF-Token": token },
    ...(body !== undefined
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  })
}
export function useRentalResource<T>(path: string | null) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<{
    path: string | null
    version: number
    data?: T
    error: string
  }>({ path: null, version: -1, error: "" })
  useEffect(() => {
    if (!path) return
    let active = true
    api<T>(`/api/rental${path}`)
      .then((data) => {
        if (active) setState({ path, version, data, error: "" })
      })
      .catch((e) => {
        if (active) setState({ path, version, error: e.message })
      })
    return () => {
      active = false
    }
  }, [path, version])
  const refresh = useCallback(() => setVersion((x) => x + 1), [])
  return {
    data: state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : "",
    loading:
      Boolean(path) && (state.path !== path || state.version !== version),
    refresh,
  }
}
type RentalContextType = {
  session: RentalSession | null
  sessionError: string
  saved: Set<string>
  notice: string
  notify: (s: string) => void
  refreshSession: () => Promise<void>
  toggleSaved: (p: RentalProperty) => Promise<void>
  savedVersion: number
  changedSaved: () => void
}
const RentalContext = createContext<RentalContextType | null>(null)
export function RentalProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RentalSession | null>(null),
    [sessionError, setSessionError] = useState("")
  const [saved, setSaved] = useState(new Set<string>()),
    [savedVersion, setSavedVersion] = useState(0),
    [notice, setNotice] = useState("")
  const navigate = useNavigate(),
    location = useLocation()
  const refreshSession = useCallback(async () => {
    const value = await rentalSession()
    setSession(value)
    setSessionError("")
  }, [])
  useEffect(() => {
    rentalSession()
      .then(setSession)
      .catch((e) => setSessionError(e.message))
  }, [])
  useEffect(() => {
    if (!session?.user) return
    let active = true
    api<{ lists: { propertyIds: string[] }[] }>("/api/rental/wishlists")
      .then((d) => {
        if (active) setSaved(new Set(d.lists.flatMap((x) => x.propertyIds)))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [session?.user, savedVersion])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(""), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  const changedSaved = () => setSavedVersion((x) => x + 1)
  async function toggleSaved(property: RentalProperty) {
    if (!session?.user) {
      navigate(
        `/login?next=${encodeURIComponent(location.pathname + location.search)}`
      )
      return
    }
    try {
      const { lists } = await api<{
        lists: { id: string; propertyIds: string[] }[]
      }>("/api/rental/wishlists")
      if (saved.has(property.id)) {
        for (const list of lists.filter((l) =>
          l.propertyIds.includes(property.id)
        ))
          await rentalRequest(
            `/wishlists/${list.id}/items/${property.id}`,
            undefined,
            "DELETE",
            session.csrf
          )
        setNotice("Removed from your wishlist")
      } else {
        const list =
          lists[0] ||
          (await rentalRequest<{ id: string }>(
            "/wishlists",
            { name: "Dream getaways" },
            "POST",
            session.csrf
          ))
        await rentalRequest(
          `/wishlists/${list.id}/items`,
          { propertyId: property.id },
          "POST",
          session.csrf
        )
        setNotice("Saved to your wishlist")
      }
      setSaved((prev) => {
        const next = new Set(prev)
        if (next.has(property.id)) next.delete(property.id)
        else next.add(property.id)
        return next
      })
      changedSaved()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not update wishlist")
    }
  }
  return (
    <RentalContext.Provider
      value={{
        session,
        sessionError,
        saved: session?.user ? saved : new Set(),
        notice,
        notify: setNotice,
        refreshSession,
        toggleSaved,
        savedVersion,
        changedSaved,
      }}
    >
      {children}
    </RentalContext.Provider>
  )
}
export function useRental() {
  const value = useContext(RentalContext)
  if (!value) throw Error("Rental provider missing")
  return value
}
export function RentalDialog({
  title,
  children,
  close,
}: {
  title: string
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      className="r-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="r-dialog-head">
        <button
          className="r-icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          ×
        </button>
        <h2>{title}</h2>
        <span />
      </div>
      <div className="r-dialog-body">{children}</div>
    </dialog>
  )
}
