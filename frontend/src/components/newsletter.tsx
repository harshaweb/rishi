import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Loader2, Mail } from "lucide-react"
import { api } from "../lib/api"
import { trackEvent } from "../lib/analytics"
export function Newsletter({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [pending, setPending] = useState(false)
  const validEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
  return (
    <form
      className={`newsletter-form ${compact ? "small" : ""}`}
      onSubmit={async (e) => {
        e.preventDefault()
        setAttempted(true)
        setError("")
        setMessage("")
        if (!validEmail || !consent) return
        setPending(true)
        try {
          const result = await api<{ message: string }>("/api/newsletter", {
            method: "POST",
            body: JSON.stringify({ email, consent }),
          })
          setMessage(result.message)
          trackEvent("newsletter_signup")
          setEmail("")
          setConsent(false)
          setAttempted(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Please try again.")
        } finally {
          setPending(false)
        }
      }}
      noValidate
    >
      <div className="newsletter-input">
        <label
          className="sr-only"
          htmlFor={compact ? "footer-newsletter-email" : "newsletter-email"}
        >
          Email address
        </label>
        <Mail size={16} />
        <input
          id={compact ? "footer-newsletter-email" : "newsletter-email"}
          type="email"
          autoComplete="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={attempted && !validEmail}
        />
        <button
          aria-label="Subscribe to newsletter"
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
      </div>
      {attempted && !validEmail && (
        <span className="field-error">Enter a valid email address.</span>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          I agree to receive occasional emails and the{" "}
          <Link to="/privacy-policy">Privacy Policy</Link>.
        </span>
      </label>
      {attempted && !consent && (
        <span className="field-error">
          Please consent to receive the newsletter.
        </span>
      )}
      {message && (
        <p className="success-text" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
