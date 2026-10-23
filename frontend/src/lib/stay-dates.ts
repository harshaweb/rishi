export type BlockedStayDates = { start: string; end: string }[]

export function unavailableNight(date: string, blocked: BlockedStayDates) {
  return blocked.some((b) => date >= b.start.slice(0, 10) && date < b.end.slice(0, 10))
}

export function availableStay(start: string, end: string, blocked: BlockedStayDates) {
  const arrival = Date.parse(`${start}T00:00:00Z`)
  const departure = Date.parse(`${end}T00:00:00Z`)
  const nights = (departure - arrival) / 86400000
  return Number.isInteger(nights) && nights >= 1 && nights <= 90 &&
    !blocked.some((b) => start < b.end.slice(0, 10) && end > b.start.slice(0, 10))
}
