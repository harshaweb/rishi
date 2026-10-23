import { useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useForm, type Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowUpRight, CheckCircle2, Loader2, LockKeyhole } from "lucide-react"
import { applicationSchema, leadSchema } from "../../../server/src/validation"
import { trackEvent } from "../lib/analytics"
import { api, ApiError } from "../lib/api"
import { useContent } from "../lib/content"
import { Eyebrow } from "./ui"
type LeadInput = z.input<typeof leadSchema>
export function LeadForm({
  compact = false,
  kind = "quote",
}: {
  compact?: boolean
  kind?: "quote" | "contact" | "website" | "application" | "marketing"
}) {
  const { content } = useContent()
  const [params] = useSearchParams()
  const [error, setErrorMessage] = useState("")
  const [result, setResult] = useState<{
    reference: string
    emailStatus: string
  } | null>(null)
  const [submissionId] = useState(() => crypto.randomUUID())
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<LeadInput, unknown, z.output<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      submissionId,
      kind,
      service: params.get("service") || "Not sure yet",
      website: "",
      companyFax: "",
    },
  })
  async function submit(data: z.output<typeof leadSchema>) {
    setErrorMessage("")
    try {
      const saved = await api<{
        reference: string
        emailStatus: string
        duplicate?: boolean
      }>("/api/leads", { method: "POST", body: JSON.stringify(data) })
      setResult(saved)
      if (!saved.duplicate) trackEvent("generate_lead")
    } catch (err) {
      if (err instanceof ApiError)
        for (const [key, value] of Object.entries(err.fields))
          setError(key as Path<LeadInput>, { message: value })
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Your enquiry could not be saved. Please try again."
      )
    }
  }
  if (result)
    return (
      <div className="form-success" role="status">
        <CheckCircle2 size={42} />
        <Eyebrow>A GOOD NEXT STEP</Eyebrow>
        <h3>Your idea is in good hands.</h3>
        <p>
          Your enquiry has been saved. Keep your reference{" "}
          <strong>{result.reference}</strong> for future conversations.
        </p>
        <p className="muted">
          {result.emailStatus === "provider-accepted"
            ? "Confirmation and notification emails have been accepted by the email provider. Delivery has not been independently confirmed."
            : result.emailStatus === "partial"
              ? "Your enquiry is saved. The provider accepted one notification, but another could not be sent. Delivery is not confirmed."
              : result.emailStatus === "failed"
                ? "Your enquiry is saved, but we could not send the confirmation email. Please keep your reference."
                : "Email notifications are not configured, so no confirmation email has been sent. Your enquiry is available to our team."}
        </p>
        <button
          className="button button-secondary"
          onClick={() => {
            reset({
              submissionId: crypto.randomUUID(),
              kind,
              service: "Not sure yet",
              website: "",
              companyFax: "",
            })
            setResult(null)
          }}
        >
          Send another enquiry
          <ArrowUpRight size={16} />
        </button>
      </div>
    )
  const field = (
    name: Path<LeadInput>,
    label: string,
    placeholder: string,
    type = "text",
    required = true
  ) => (
    <div className="field">
      <label htmlFor={`lead-${name}`}>
        {label}
        {required && <span> *</span>}
      </label>
      <input
        id={`lead-${name}`}
        type={type}
        placeholder={placeholder}
        {...register(name)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `error-${name}` : undefined}
        autoComplete={
          name === "name"
            ? "name"
            : name === "email"
              ? "email"
              : name === "phone"
                ? "tel"
                : name === "company"
                  ? "organization"
                  : undefined
        }
      />
      {errors[name] && (
        <span className="field-error" id={`error-${name}`}>
          {String(errors[name]?.message)}
        </span>
      )}
    </div>
  )
  return (
    <form
      className={`lead-form ${compact ? "compact" : ""}`}
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <div className="form-heading">
        <div className="form-kicker">
          <span /> YOUR NEXT BIG IDEA
        </div>
        <h3>Tell us a little about your project.</h3>
        <span>Fields marked * are required.</span>
      </div>
      <input type="hidden" {...register("submissionId")} />
      <input type="hidden" {...register("kind")} />
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="company-fax">Company fax</label>
        <input
          id="company-fax"
          tabIndex={-1}
          autoComplete="off"
          {...register("companyFax")}
        />
      </div>
      <fieldset className="enquiry-fieldset">
        <legend>
          <span>01</span> About you
        </legend>
        <div className="form-grid">
          {field("name", "Full name", "Your name")}
          {field("email", "Business email", "you@company.com", "email")}
          {field("phone", "Phone with country code", "+91 98765 43210", "tel")}
          {field("company", "Company name", "Your company")}
        </div>
      </fieldset>
      <fieldset className="enquiry-fieldset">
        <legend>
          <span>02</span> Your project
        </legend>
        <div className="form-grid">
          {field(
            "website",
            "Current website",
            "https://yourcompany.com",
            "url",
            false
          )}
          <div className="field">
            <label htmlFor="lead-service">What can we help with? *</label>
            <select
              id="lead-service"
              {...register("service")}
              aria-invalid={Boolean(errors.service)}
            >
              <option>Not sure yet</option>
              {content.services.map((s) => (
                <option key={s.id}>{s.title}</option>
              ))}
            </select>
            {errors.service && (
              <span className="field-error">{errors.service.message}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="lead-budget">Estimated budget *</label>
            <select
              id="lead-budget"
              {...register("budget")}
              aria-invalid={Boolean(errors.budget)}
              defaultValue=""
            >
              <option value="" disabled>
                Select your budget
              </option>
              {[
                "Under ₹50,000",
                "₹50,000–₹2 lakh",
                "₹2–5 lakh",
                "₹5 lakh+",
                "Let’s discuss",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            {errors.budget && (
              <span className="field-error">Choose an indicative budget.</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="lead-timeline">Project timeline *</label>
            <select
              id="lead-timeline"
              {...register("timeline")}
              aria-invalid={Boolean(errors.timeline)}
              defaultValue=""
            >
              <option value="" disabled>
                When are you looking to start?
              </option>
              {[
                "As soon as practical",
                "1–3 months",
                "3–6 months",
                "Exploring options",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            {errors.timeline && (
              <span className="field-error">
                Choose your preferred timeline.
              </span>
            )}
          </div>
        </div>
        <div className="field">
          <label htmlFor="lead-message">A little about your project *</label>
          <textarea
            id="lead-message"
            rows={4}
            placeholder="Your goals, your idea, or the challenge you’re looking to solve…"
            {...register("message")}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "error-message" : undefined}
          />
          {errors.message && (
            <span className="field-error" id="error-message">
              {errors.message.message}
            </span>
          )}
        </div>
      </fieldset>
      <label className="check-label">
        <input type="checkbox" {...register("consent")} />
        <span>
          I agree to the <Link to="/privacy-policy">Privacy Policy</Link> and
          consent to Harshaweb contacting me about this enquiry. *
        </span>
      </label>
      {errors.consent && (
        <span className="field-error">{errors.consent.message}</span>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="form-bottom">
        <span>
          <LockKeyhole size={13} />
          Your ideas stay between us.
        </span>
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="spin" />
              Saving enquiry…
            </>
          ) : (
            <>
              Let’s start a conversation
              <ArrowUpRight size={16} />
            </>
          )}
        </button>
      </div>
    </form>
  )
}
export function ApplicationForm() {
  const { content } = useContent()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<
    z.input<typeof applicationSchema>,
    unknown,
    z.output<typeof applicationSchema>
  >({
    resolver: zodResolver(applicationSchema),
    defaultValues: { portfolio: "", jobId: "" },
  })
  async function submit(data: z.output<typeof applicationSchema>) {
    setMessage("")
    setError("")
    const file = fileRef.current?.files?.[0]
    if (
      file &&
      (file.type !== "application/pdf" || file.size > 4 * 1024 * 1024)
    ) {
      setError("Please upload a PDF no larger than 4 MB.")
      return
    }
    const form = new FormData()
    Object.entries(data).forEach(([key, value]) =>
      form.append(key, String(value))
    )
    if (file) form.append("resume", file)
    try {
      const result = await api<{ message: string }>("/api/applications", {
        method: "POST",
        body: form,
      })
      setMessage(result.message)
      reset()
      if (fileRef.current) fileRef.current.value = ""
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The application could not be saved."
      )
    }
  }
  return (
    <form
      className="lead-form"
      noValidate
      onSubmit={(event) => void handleSubmit(submit)(event)}
    >
      <h3>Introduce yourself.</h3>
      <p className="muted">
        All fields except your portfolio and résumé are required.
      </p>
      <div className="form-grid">
        {(["name", "email"] as const).map((name) => (
          <div className="field" key={name}>
            <label htmlFor={`application-${name}`}>
              {name === "name" ? "Full name *" : "Email address *"}
            </label>
            <input
              id={`application-${name}`}
              type={name === "email" ? "email" : "text"}
              {...register(name)}
            />
            {errors[name] && (
              <span className="field-error">{errors[name]?.message}</span>
            )}
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="application-job">Area of interest *</label>
        <select id="application-job" {...register("jobId")}>
          <option value="">General expression of interest</option>
          {content.jobs.map((job) => (
            <option value={job.id} key={job.id}>
              {job.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="application-portfolio">Portfolio or profile URL</label>
        <input
          id="application-portfolio"
          type="url"
          placeholder="https://…"
          {...register("portfolio")}
        />
        {errors.portfolio && (
          <span className="field-error">{errors.portfolio.message}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="application-message">
          Tell us about your skills and interests *
        </label>
        <textarea id="application-message" rows={5} {...register("message")} />
        {errors.message && (
          <span className="field-error">{errors.message.message}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="resume">Résumé (PDF, maximum 4 MB)</label>
        <input id="resume" ref={fileRef} type="file" accept="application/pdf" />
      </div>
      <label className="check-label">
        <input type="checkbox" {...register("consent")} />
        <span>
          I consent to my application being reviewed and handled under the{" "}
          <Link to="/privacy-policy">Privacy Policy</Link>. *
        </span>
      </label>
      {errors.consent && (
        <span className="field-error">Please agree to the privacy policy.</span>
      )}
      {message && (
        <div className="success-box" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving application…" : "Send your application"}
        <ArrowUpRight size={16} />
      </button>
    </form>
  )
}
