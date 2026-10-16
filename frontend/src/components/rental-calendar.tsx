import { useState } from "react"
import { availableStay, unavailableNight } from "../lib/stay-dates"
export function RentalCalendar({
  blocked,
  choose,
  selected,
  checkout,
  choosing = "checkIn",
  chooseField,
}: {
  blocked: { start: string; end: string }[]
  choose: (date: string) => void
  selected?: string
  checkout?: string
  choosing?: "checkIn" | "checkOut"
  chooseField?: (field: "checkIn" | "checkOut") => void
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
      {chooseField && <div className="r-date-picker-tabs" role="group" aria-label="Choose booking dates">
        <button type="button" aria-pressed={choosing === "checkIn"} onClick={() => chooseField("checkIn")}>
          Check-in <b>{selected || "Select date"}</b>
        </button>
        <button type="button" aria-pressed={choosing === "checkOut"} disabled={!selected} onClick={() => chooseField("checkOut")}>
          Check-out <b>{checkout || "Select date"}</b>
        </button>
      </div>}
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
            unavailable = choosing === "checkOut" && selected
              ? !availableStay(selected, date, blocked)
              : unavailableNight(date, blocked)
          return (
            <button
              key={date}
              disabled={date < today || unavailable}
              aria-label={`${date}${date < today || unavailable ? " unavailable" : ` ${choosing === "checkOut" ? "check-out" : "check-in"}`}`}
              aria-pressed={selected === date || checkout === date}
              className={selected === date || checkout === date ? "is-selected" : selected && checkout && date > selected && date < checkout ? "is-in-range" : undefined}
              onClick={() => choose(date)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="r-muted r-small" role="status">
        {choosing === "checkOut"
          ? "Choose checkout within 90 nights. Unavailable dates can’t be selected."
          : "Choose check-in, then checkout. Unavailable dates can’t be selected."}
      </p>
    </div>
  )
}
