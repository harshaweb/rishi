import express, { type RequestHandler } from "express"
import { createHash, createHmac, randomBytes } from "node:crypto"
import { z } from "zod"
import { collection as c, record } from "./mongo-rental-store.js"
import { rentalFail as fail } from "./rental-errors.js"

const provider = "https://api.digitallocker.gov.in/public/oauth2/1"
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
export const digilockerRequired = () => process.env.DIGILOCKER_REQUIRED === "1"
export function digilockerConfigured() {
  return Boolean(
    process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET
  )
}
export function digilockerCallback() {
  return new URL(
    "/api/rental/digilocker/callback",
    process.env.SITE_URL || "http://localhost:5173"
  ).href
}
const secure = () => process.env.NODE_ENV === "production"
const cookieName = () =>
  secure() ? "__Host-omshivraj.digilocker" : "omshivraj.digilocker"
const cookieOptions = () => ({
  httpOnly: true,
  secure: secure(),
  sameSite: "lax" as const,
  path: "/",
})
const credentials = () =>
  `Basic ${Buffer.from(`${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`).toString("base64")}`
export async function hasDigiLocker(userId: string) {
  return Boolean(
    await c("IdentityVerification").findOne({ userId, provider: "DIGILOCKER" })
  )
}
async function providerJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw fail(
      502,
      "DigiLocker could not complete verification. Please try again."
    )
  return (await response.json()) as Record<string, unknown>
}
export function digiLockerRouter(
  signed: RequestHandler,
  limit: RequestHandler
) {
  const router = express.Router()
  router.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer")
    next()
  })
  router.post("/start", signed, limit, async (req, res, next) => {
    try {
      const input = z
        .object({
          consent: z.literal(true),
          returnTo: z
            .string()
            .regex(/^\/stays\/[a-z0-9-]+$/)
            .max(250),
        })
        .parse(req.body)
      if (!digilockerConfigured())
        throw fail(
          503,
          "DigiLocker verification is awaiting setup. Please contact support before booking."
        )
      const state = randomBytes(32).toString("base64url")
      const verifier = randomBytes(48).toString("base64url")
      await c("IdentityAttempt").insertOne(
        record({
          stateHash: hash(state),
          verifier,
          userId: req.rentalUser!.id,
          sessionVersion: req.rentalUser!.sessionVersion,
          returnTo: input.returnTo,
          consentAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60000),
        })
      )
      // A dedicated Lax cookie binds the OAuth redirect to this browser while
      // leaving the application's Strict session cookie unchanged.
      res.cookie(cookieName(), state, {
        ...cookieOptions(),
        maxAge: 10 * 60000,
      })
      const url = new URL(`${provider}/authorize`)
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: process.env.DIGILOCKER_CLIENT_ID!,
        redirect_uri: digilockerCallback(),
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        purpose: "verification",
      }).toString()
      res.json({ url: url.href })
    } catch (error) {
      next(error)
    }
  })
  router.get("/callback", limit, async (req, res) => {
    let returnTo = "/search"
    const finish = (status: string) => {
      const url = new URL(
        returnTo,
        process.env.SITE_URL || "http://localhost:5173"
      )
      url.searchParams.set("digilocker", status)
      res.redirect(303, url.href)
    }
    try {
      const state = z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .parse(req.query.state)
      const cookie = (req.headers.cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${cookieName()}=`))
        ?.slice(cookieName().length + 1)
      if (!cookie || hash(cookie) !== hash(state)) return finish("expired")
      const attempt = await c("IdentityAttempt").findOneAndDelete({
        stateHash: hash(state),
        expiresAt: { $gt: new Date() },
      })
      res.clearCookie(cookieName(), cookieOptions())
      if (!attempt) return finish("expired")
      returnTo = String(attempt.returnTo)
      if (req.query.error) return finish("cancelled")
      if (!digilockerConfigured()) return finish("unavailable")
      const code = z.string().min(1).max(2048).parse(req.query.code)
      const token = await providerJson(`${provider}/token`, {
        method: "POST",
        headers: {
          Authorization: credentials(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: digilockerCallback(),
          code_verifier: String(attempt.verifier),
        }).toString(),
      })
      if (
        typeof token.access_token !== "string" ||
        token.token_type !== "Bearer"
      )
        return finish("failed")
      try {
        const profile = await providerJson(`${provider}/user`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        })
        const subject = z.string().uuid().parse(profile.digilockerid)
        // This verifies control of an Aadhaar-linked DigiLocker account. We do
        // not fetch, copy, or claim to authenticate an identity document.
        if (profile.eaadhaar !== "Y") return finish("not-linked")
        if (token.digilockerid && token.digilockerid !== subject)
          return finish("failed")
        const user = await c("User").findOne({
          id: attempt.userId,
          active: true,
          sessionVersion: attempt.sessionVersion,
        })
        if (!user) return finish("expired")
        await c("IdentityVerification").updateOne(
          { userId: user.id, provider: "DIGILOCKER" },
          {
            $set: {
              verifiedAt: new Date(),
              consentAt: attempt.consentAt,
              subjectHash: createHmac("sha256", process.env.SESSION_SECRET!)
                .update(subject)
                .digest("hex"),
            },
            $setOnInsert: record({ userId: user.id, provider: "DIGILOCKER" }),
          },
          { upsert: true }
        )
        return finish("verified")
      } finally {
        // No access or refresh tokens are retained in our database or logs.
        for (const value of [token.refresh_token, token.access_token]) {
          if (typeof value !== "string") continue
          try {
            await fetch(`${provider}/revoke`, {
              method: "POST",
              headers: {
                Authorization: credentials(),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ token: value }),
              redirect: "error",
              signal: AbortSignal.timeout(5000),
            })
          } catch {
            /* Provider access expires; never persist tokens for retry. */
          }
        }
      }
    } catch {
      return finish("failed")
    }
  })
  return router
}
