import "dotenv/config"
import { z } from "zod"
const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined)
export const environment = z
  .object({
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "Use a PostgreSQL connection URL."
      ),
    SESSION_SECRET: z.string().min(32),
    SITE_URL: z.string().url().default("http://localhost:5173"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    TRUST_PROXY: z.enum(["0", "1"]).optional(),
    RESEND_API_KEY: optional,
    EMAIL_FROM: optional,
    ADMIN_NOTIFICATION_EMAIL: optional,
    S3_BUCKET: optional,
    S3_REGION: optional,
    S3_ENDPOINT: optional,
    GA4_MEASUREMENT_ID: z
      .string()
      .regex(/^G-[A-Z0-9]+$/)
      .or(z.literal(""))
      .optional(),
    GTM_CONTAINER_ID: z
      .string()
      .regex(/^GTM-[A-Z0-9]+$/)
      .or(z.literal(""))
      .optional(),
  })
  .parse(process.env)
if (
  environment.NODE_ENV === "production" &&
  !environment.SITE_URL.startsWith("https://")
)
  throw new Error("Production SITE_URL must use HTTPS.")
if (
  environment.ADMIN_NOTIFICATION_EMAIL &&
  !z.string().email().safeParse(environment.ADMIN_NOTIFICATION_EMAIL).success
)
  throw new Error("ADMIN_NOTIFICATION_EMAIL must be a valid email address.")
