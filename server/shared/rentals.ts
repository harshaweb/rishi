export const rentalCategories = [
  "City stays",
  "Cabins",
  "Amazing views",
  "Pools",
  "Countryside",
  "Luxury stays",
  "Apartments",
  "Villas",
  "Unique stays",
  "Pet-friendly stays",
  "Budget stays",
  "Family-friendly stays",
]
export const rentalAmenities = [
  "Wi-Fi",
  "Kitchen",
  "Parking",
  "Air conditioning",
  "Pool",
  "Washing machine",
  "Workspace",
  "Pets allowed",
]
export type RentalProperty = {
  checkInTime: string
  checkOutTime: string
  houseRules: string
  discountPercent: number
  id: string
  slug: string
  hostId: string
  title: string
  city: string
  address: string
  category: string
  type: string
  description: string
  nightlyRate: number
  cleaningFee: number
  capacity: number
  bedrooms: number
  beds: number
  bathrooms: number
  latitude: number | null
  longitude: number | null
  amenities: string[]
  images: string[]
  status: string
  cancellation: string
  instantBook: boolean
  bookingMode: string
  demo: boolean
  rating: number | null
  reviewCount: number
  hostName?: string
  createdAt?: string
}
export type RentalUser = {
  digilockerVerified?: boolean
  id: string
  name: string
  email: string
  role: "GUEST" | "HOST" | "ADMIN"
  verified: boolean
  phone?: string
  photo?: string
  notifications?: boolean
}
export type RentalBooking = {
  address?: string
  cancellation: string
  id: string
  reference: string
  propertyId: string
  guestId: string
  checkIn: string
  checkOut: string
  guests: number
  status: string
  total: number
  nightlySubtotal: number
  cleaningFee: number
  platformFee: number
  tax: number
  discount: number
  expiresAt: string | null
  paymentStatus: string
  title: string
  city: string
  slug: string
  image: string
  bookingMode: string
  bookingType?: "OVERNIGHT" | "HOURLY"
  durationHours?: number
  arrivalTime?: string
  departureTime?: string
  guestName?: string
  reviewId?: string
}
// ₹1,500 for the two-hour minimum; each extra hour is ₹750.
export const RENTAL_HOURLY_RATE = 75000
export const RENTAL_TWO_GUEST_NIGHTLY_RATE = 359900
export const RENTAL_MAX_GUESTS = 2
export function rentalNightlyRate(property: Pick<RentalProperty, "nightlyRate" | "capacity">, guests = 1) {
  return guests >= 2 && property.capacity >= 2
    ? RENTAL_TWO_GUEST_NIGHTLY_RATE
    : property.nightlyRate
}
export function rentalMoney(paise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(paise / 100)
}
export function rentalDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}
