import { z } from "zod"
import { settings } from "../shared/content.js"
import { videoSource } from "../shared/engagement.js"
import { sectionsSchema } from "../shared/sections.js"
const optionalHttps = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return url.protocol === "https:" && !url.username && !url.password
    } catch {
      return false
    }
  }, "Use a complete HTTPS URL without embedded credentials.")
export const siteSettingsSchema = z
  .object(
    Object.fromEntries(
      Object.keys(settings).map((key) => {
        let field: z.ZodType<string> = z.string().trim().max(3000)
        if (key === "sectionContent")
          field = z
            .string()
            .max(200000)
            .refine((value) => {
              try {
                return sectionsSchema.safeParse(JSON.parse(value)).success
              } catch {
                return false
              }
            }, "Use valid website section content with supported fields and section names.")
        else if (/^video\dUrl$/.test(key))
          field = z
            .string()
            .trim()
            .max(1000)
            .refine(
              (value) => !value || Boolean(videoSource(value)),
              "Use a YouTube/Vimeo link or a local /videos/name.mp4 or .webm path."
            )
        else if (key.endsWith("Url")) field = optionalHttps
        else if (
          [
            "contactPhone",
            "contactPhone2",
            "contactPhone3",
            "whatsappPhone",
          ].includes(key)
        )
          field = z
            .string()
            .trim()
            .refine(
              (value) =>
                !value ||
                /^\+[1-9]\d{7,14}$/.test(value.replace(/[ ()-]/g, "")),
              "Use a phone number with country code and 8–15 digits."
            )
        else if (key === "contactEmail")
          field = z.union([z.literal(""), z.string().trim().email().max(254)])
        return [key, field]
      })
    )
  )
  .strict()
