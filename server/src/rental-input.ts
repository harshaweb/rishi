import { z } from "zod"
import { rentalAmenities } from "../shared/rentals.js"
import { rentalCity } from "../shared/rental-region.js"
const text = (max: number) => z.string().trim().min(1).max(max)
export const dateInput = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.coerce.number().int().min(1).max(30),
  coupon: z.string().max(50).default(""),
})
export const propertySchema = z.object({
  checkInTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("15:00"),
  checkOutTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("11:00"),
  houseRules: text(3000).default("No parties or smoking indoors."),
  discountPercent: z.coerce.number().int().min(0).max(50).default(0),
  title: text(150),
  slug: text(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  city: text(100)
    .refine(
      (city) => Boolean(rentalCity(city)),
      "Choose a city in Delhi NCR: Delhi, Gurugram, Noida, Greater Noida, Ghaziabad or Faridabad."
    )
    .transform((city) => rentalCity(city)!),
  address: text(400),
  category: text(100),
  type: z.enum(["Apartment", "Villa", "Cottage", "Cabin", "Homestay", "House"]),
  description: text(10000),
  nightlyRate: z.coerce.number().int().min(10000).max(100000000),
  cleaningFee: z.coerce.number().int().min(0).max(10000000).default(0),
  capacity: z.coerce.number().int().min(1).max(30),
  bedrooms: z.coerce.number().int().min(0).max(20),
  beds: z.coerce.number().int().min(1).max(30),
  bathrooms: z.coerce.number().int().min(1).max(20),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  cancellation: z.enum(["FLEXIBLE", "MODERATE", "STRICT"]).default("FLEXIBLE"),
  bookingMode: z.enum(["HOST_APPROVAL", "PAYMENT"]).default("HOST_APPROVAL"),
  instantBook: z.boolean().default(false),
  amenities: z
    .array(z.enum(rentalAmenities as [string, ...string[]]))
    .max(20)
    .default([]),
})
