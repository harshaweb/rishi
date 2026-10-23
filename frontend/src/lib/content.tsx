import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { initialContent, type Content } from "../../../server/shared/content"
import { api } from "./api"
const Context = createContext<{
  content: Content
  refresh: () => Promise<void>
}>({ content: initialContent, refresh: async () => {} })
export function ContentProvider({
  children,
  initial,
}: {
  children: ReactNode
  initial?: Content
}) {
  const [content, setContent] = useState(initial || initialContent)
  const [error, setError] = useState("")
  async function refresh() {
    try {
      setContent(await api<Content>("/api/content"))
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Content is unavailable.")
    }
  }
  useEffect(() => {
    if (!initial) {
      void api<Content>("/api/content")
        .then(setContent)
        .catch((err) => setError(err.message))
    }
  }, [initial])
  return (
    <Context.Provider value={{ content, refresh }}>
      {error && (
        <div className="system-notice" role="alert">
          Live content is unavailable. You’re viewing the included editorial
          content. <button onClick={() => void refresh()}>Try again</button>
        </div>
      )}
      {children}
    </Context.Provider>
  )
}
export const useContent = () => useContext(Context)
