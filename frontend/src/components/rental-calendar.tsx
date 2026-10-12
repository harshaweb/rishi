import { useState } from "react"
export function RentalCalendar({
  blocked,
  choose,
  selected,
}: {
  blocked: { start: string; end: string }[]
  choose: (date: string) => void
  selected?: string
}) {
  const [offset, setOffset] = useState(0),
    now = new Date(),
    month = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1)),
    days = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)
    ).getUTCDate()
  const today = now.toISOString().slice(0, 10)
  return (
    <div className="r-calendar">
      <div className="r-section-heading">
        <button
          className="r-secondary"
          aria-label="Previous month"
          disabled={offset === 0}
          onClick={() => setOffset(offset - 1)}
        >
          ←
        </button>
        <b>
          {month.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </b>
        <button
          className="r-secondary"
          aria-label="Next month"
          onClick={() => setOffset(offset + 1)}
        >
          →
        </button>
      </div>
      <div className="r-calendar-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: month.getUTCDay() }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = new Date(
              Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i + 1)
            )
              .toISOString()
              .slice(0, 10),
            unavailable = blocked.some(
              (b) => date >= b.start.slice(0, 10) && date < b.end.slice(0, 10)
            )
          return (
            <button
              key={date}
              disabled={date < today || unavailable}
              aria-label={`${date}${unavailable ? " unavailable" : ""}`}
              aria-pressed={selected === date}
              className={selected === date ? "is-selected" : undefined}
              onClick={() => choose(date)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="r-muted r-small">
        Unavailable nights are disabled. Select an available arrival day;
        checkout and final availability are checked in your booking form.
      </p>
    </div>
  )
}
