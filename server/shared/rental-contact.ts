export const rentalContact = {
  phone: "+91 70781 77772",
  callUrl: "tel:+917078177772",
}

export function bookingWhatsAppLink(message: string) {
  const number = rentalContact.phone.replace(/\D/g, "")
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

type BookingMessageDetails = {
  reference: string
  title: string
  city?: string
  checkIn: string
  checkOut?: string
  guests: number
  total: number
  nightlySubtotal?: number
  cleaningFee?: number
  platformFee?: number
  tax?: number
  discount?: number
  bookingType?: "OVERNIGHT" | "HOURLY"
  durationHours?: number
  guestName?: string
  arrivalTime?: string
  departureTime?: string
  checkInTime?: string
  checkOutTime?: string
}

function messageTime(value?: string) {
  if (!value) return undefined
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`
}

function messageMoney(amount?: number) {
  return typeof amount === "number"
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100)
    : undefined
}

export function bookingWhatsAppMessage(booking: BookingMessageDetails) {
  const hourly = booking.bookingType === "HOURLY"
  const dates = hourly
    ? `${booking.checkIn}${booking.arrivalTime ? `, ${messageTime(booking.arrivalTime)}` : ""}${booking.departureTime ? `–${messageTime(booking.departureTime)}` : ""}${booking.durationHours ? ` (${booking.durationHours} hours)` : ""}`
    : `${booking.checkIn}${booking.checkOut ? ` to ${booking.checkOut}` : ""}`
  const checkIn = !hourly && messageTime(booking.checkInTime)
  const checkOut = !hourly && messageTime(booking.checkOutTime)
  const fees = [
    booking.nightlySubtotal !== undefined && `Stay subtotal: ${messageMoney(booking.nightlySubtotal)}`,
    booking.cleaningFee !== undefined && booking.cleaningFee > 0 && `Cleaning fee: ${messageMoney(booking.cleaningFee)}`,
    booking.platformFee !== undefined && booking.platformFee > 0 && `Platform fee: ${messageMoney(booking.platformFee)}`,
    booking.tax !== undefined && booking.tax > 0 && `Taxes: ${messageMoney(booking.tax)}`,
    booking.discount !== undefined && booking.discount > 0 && `Discount: −${messageMoney(booking.discount)}`,
  ].filter(Boolean)

  return [
    "Hi, please confirm my stay booking request.",
    `Booking reference: ${booking.reference}`,
    `Stay: ${booking.title}${booking.city ? `, ${booking.city}` : ""}`,
    `Dates${hourly ? " and time" : ""}: ${dates}`,
    ...(booking.guestName ? [`Client name: ${booking.guestName}`] : []),
    ...(!hourly && checkIn ? [`Check-in: after ${checkIn}`] : []),
    ...(!hourly && checkOut ? [`Checkout: before ${checkOut}`] : []),
    `Guests: ${booking.guests}`,
    ...fees,
    `Total price: ${messageMoney(booking.total)}`,
  ].join("\n")
}
