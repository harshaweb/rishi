import type { Document } from "mongodb"
import { createHmac, timingSafeEqual } from "node:crypto"
import { rentalFail } from "./rental-errors.js"
export function rentalDates(
  checkIn: string,
  checkOut: string,
  allowPast = false
) {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  if (!valid(checkIn) || !valid(checkOut))
    throw rentalFail(400, "Choose valid check-in and checkout dates.")
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000
  if (
    nights < 1 ||
    nights > 90 ||
    (!allowPast && checkIn < new Date().toISOString().slice(0, 10))
  )
    throw rentalFail(400, "Choose 1–90 nights, starting today or later.")
  return nights
}
export function calculateRentalPrice(
  rate: number,
  nights: number,
  cleaning: number,
  feeBps: number,
  taxBps: number,
  discountPercent = 0
) {
  const values = [rate, nights, cleaning, feeBps, taxBps, discountPercent]
  if (
    values.some((x) => !Number.isSafeInteger(x) || x < 0) ||
    rate < 1 ||
    nights < 1 ||
    nights > 90 ||
    discountPercent > 50 ||
    feeBps > 3000 ||
    taxBps > 4000
  )
    throw rentalFail(400, "Invalid pricing configuration.")
  const nightlySubtotal = rate * nights
  const discount = Math.floor((nightlySubtotal * discountPercent) / 100)
  const platformFee = Math.round(
    ((nightlySubtotal - discount) * feeBps) / 10000
  )
  const tax = Math.round(
    ((nightlySubtotal - discount + cleaning + platformFee) * taxBps) / 10000
  )
  const total = nightlySubtotal - discount + cleaning + platformFee + tax
  if (!Number.isSafeInteger(total) || total > 2000000000)
    throw rentalFail(400, "This booking exceeds the supported amount.")
  return {
    nights,
    nightlySubtotal,
    cleaningFee: cleaning,
    platformFee,
    tax,
    discount,
    total,
    currency: "INR",
  }
}
export function verifyRentalSignature(
  message: string | Buffer,
  signature: string,
  secret: string
) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(
      createHmac("sha256", secret).update(message).digest("hex"),
      "hex"
    )
  )
}
export async function rentalEmail(
  email: string,
  subject: string,
  text: string
) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return "NOT_CONFIGURED"
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    })
    return r.ok ? "PROVIDER_ACCEPTED" : "FAILED"
  } catch {
    return "FAILED"
  }
}
export async function razorpay(path: string, method = "GET", body?: unknown) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw rentalFail(
      503,
      "Online payments are not configured. No charge has been made."
    )
  const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok)
    throw rentalFail(
      502,
      "The payment provider could not complete this request."
    )
  return (await r.json()) as Document
}
export function rentalRefundAmount(
  total: number,
  policy: string,
  checkIn: string,
  now = Date.now()
) {
  const hours = (Date.parse(checkIn) - now) / 3600000
  if (hours <= 0) return 0
  if (policy === "FLEXIBLE") return hours >= 24 ? total : Math.floor(total / 2)
  if (policy === "MODERATE") return hours >= 120 ? total : Math.floor(total / 2)
  return hours >= 168 ? Math.floor(total / 2) : 0
}
