import { createHash, randomInt } from "node:crypto"

export function normalizePhone(value: string) {
  const raw = value.trim()
  const digits = raw.replace(/\D/g, "")
  const national = digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits
  const normalized = national.length === 10 ? `91${national}` : national
  if (normalized.length < 10 || normalized.length > 15)
    throw new Error("Enter a valid phone number with country code.")
  return `+${normalized}`
}

export const phoneOtpHash = (phone: string, code: string) =>
  createHash("sha256").update(`${phone}:${code}`).digest("hex")

export async function sendPhoneOtp(phone: string, code: string) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Phone sign-in is unavailable until SMS delivery is configured.")
    return { developmentOtp: code }
  }

  const body = new URLSearchParams({
    To: phone,
    From: TWILIO_PHONE_NUMBER,
    Body: `Your Omshivraj sign-in code is ${code}. It expires in 10 minutes. Do not share it.`,
  })
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(10000),
    }
  )
  if (!response.ok) {
    console.error("Phone OTP delivery failed with Twilio status", response.status)
    throw new Error("We could not send your code. Check the number and try again.")
  }
  return {}
}

export const createPhoneOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0")
