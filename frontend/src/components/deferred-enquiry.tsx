import { lazy, Suspense, useEffect, useRef, useState } from "react"
const LeadForm = lazy(() =>
  import("./forms").then((module) => ({ default: module.LeadForm }))
)
export function DeferredEnquiry() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "350px" }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const placeholder = (
    <div className="lead-form enquiry-placeholder">
      <h3>Tell us a little about your project.</h3>
      <p>A few details help us make our first conversation more useful.</p>
      <button className="button" onClick={() => setVisible(true)}>
        Open project enquiry form
      </button>
    </div>
  )
  return (
    <div ref={ref} className="enquiry-form-slot">
      {visible ? (
        <Suspense
          fallback={
            <div className="lead-form enquiry-placeholder" role="status">
              Preparing your enquiry form…
            </div>
          }
        >
          <LeadForm compact />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  )
}
