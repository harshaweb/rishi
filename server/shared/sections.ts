import { z } from "zod"
export const sectionDefinitions = [
  { id: "home:video", label: "Home — video introduction", body: false },
  { id: "legal:privacy", label: "Privacy policy — content", body: true },
  { id: "legal:terms", label: "Terms and conditions — content", body: true },
  { id: "legal:cookies", label: "Cookie policy — content", body: true },
  {
    id: "home:Home:1",
    label: "Home — home hero",
    body: false,
  },
  {
    id: "home:Home:2",
    label: "Home — capabilities strip",
    body: false,
  },
  {
    id: "home:Home:3",
    label: "Home — services ",
    body: false,
  },
  {
    id: "home:Home:4",
    label: "Home — why ",
    body: false,
  },
  {
    id: "home:Home:5",
    label: "Home — Section 5",
    body: false,
  },
  {
    id: "home:Home:6",
    label: "Home — work ",
    body: false,
  },
  {
    id: "home:Home:7",
    label: "Home — industry ",
    body: false,
  },
  {
    id: "home:Home:8",
    label: "Home — tech ",
    body: false,
  },
  {
    id: "home:Home:9",
    label: "Home — enquiry ",
    body: false,
  },
  {
    id: "home:Home:10",
    label: "Home — faq ",
    body: false,
  },
  {
    id: "home:Home:11",
    label: "Home — insights ",
    body: false,
  },
  {
    id: "page:Services:1",
    label: "Services — Section 1",
    body: false,
  },
  {
    id: "page:ServiceDetail:1",
    label: "ServiceDetail — page hero service detail hero",
    body: false,
  },
  {
    id: "page:ServiceDetail:2",
    label: "ServiceDetail — detail grid",
    body: false,
  },
  {
    id: "page:ServiceDetail:3",
    label: "ServiceDetail — subtle ",
    body: false,
  },
  {
    id: "page:ServiceDetail:4",
    label: "ServiceDetail — faq grid",
    body: false,
  },
  {
    id: "page:ServiceDetail:5",
    label: "ServiceDetail — Section 5",
    body: false,
  },
  {
    id: "page:Industries:1",
    label: "Industries — Section 1",
    body: false,
  },
  {
    id: "page:IndustryDetail:1",
    label: "IndustryDetail — detail grid",
    body: false,
  },
  {
    id: "page:IndustryDetail:2",
    label: "IndustryDetail — subtle ",
    body: false,
  },
  {
    id: "page:Portfolio:1",
    label: "Portfolio — Section 1",
    body: false,
  },
  {
    id: "page:ProjectDetail:1",
    label: "ProjectDetail — Section 1",
    body: false,
  },
  {
    id: "page:Resources:1",
    label: "Resources — Section 1",
    body: false,
  },
  {
    id: "page:Resources:2",
    label: "Resources — newsletter ",
    body: false,
  },
  {
    id: "page:About:1",
    label: "About — about grid",
    body: true,
  },
  {
    id: "page:About:2",
    label: "About — subtle ",
    body: true,
  },
  {
    id: "page:About:3",
    label: "About — Section 3",
    body: true,
  },
  {
    id: "page:Team:1",
    label: "Team — Section 1",
    body: false,
  },
  {
    id: "page:Process:1",
    label: "Process — process details",
    body: true,
  },
  {
    id: "page:Technology:1",
    label: "Technology — Section 1",
    body: true,
  },
  {
    id: "page:Careers:1",
    label: "Careers — careers grid",
    body: false,
  },
  {
    id: "page:Contact:1",
    label: "Contact — contact grid",
    body: false,
  },
  {
    id: "page:Unsubscribe:1",
    label: "Unsubscribe — Section 1",
    body: false,
  },
  {
    id: "page:NotFound:1",
    label: "NotFound — not found",
    body: false,
  },
  {
    id: "hero:/services",
    label: "Page heading — services",
    body: false,
  },
  {
    id: "hero:/industries",
    label: "Page heading — industries",
    body: false,
  },
  {
    id: "hero:/portfolio",
    label: "Page heading — portfolio",
    body: false,
  },
  {
    id: "hero:/resources",
    label: "Page heading — resources",
    body: false,
  },
  {
    id: "hero:/about",
    label: "Page heading — about",
    body: false,
  },
  {
    id: "hero:/team",
    label: "Page heading — team",
    body: false,
  },
  {
    id: "hero:/process",
    label: "Page heading — process",
    body: false,
  },
  {
    id: "hero:/technology",
    label: "Page heading — technology",
    body: false,
  },
  {
    id: "hero:/careers",
    label: "Page heading — careers",
    body: false,
  },
  {
    id: "hero:/contact",
    label: "Page heading — contact",
    body: false,
  },
  {
    id: "hero:/request-a-quote",
    label: "Page heading — request a quote",
    body: false,
  },
  {
    id: "hero:/videos",
    label: "Page heading — videos",
    body: false,
  },
  {
    id: "hero:/vision-and-mission",
    label: "Page heading — vision and mission",
    body: false,
  },
  {
    id: "hero:/book-a-consultation",
    label: "Page heading — book a consultation",
    body: false,
  },
  {
    id: "hero:/site-map",
    label: "Page heading — site map",
    body: false,
  },
  {
    id: "hero:/privacy-policy",
    label: "Page heading — privacy policy",
    body: false,
  },
  {
    id: "hero:/terms-and-conditions",
    label: "Page heading — terms and conditions",
    body: false,
  },
  {
    id: "hero:/cookie-policy",
    label: "Page heading — cookie policy",
    body: false,
  },
  {
    id: "header",
    label: "Header — button label",
    body: false,
  },
  {
    id: "footer",
    label: "Footer — consultation banner",
    body: false,
  },
  {
    id: "newsletter",
    label: "Footer — newsletter",
    body: false,
  },
  {
    id: "cta",
    label: "Shared call to action",
    body: false,
  },
] as const
export const sectionCopySchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    body: z.string().trim().max(20000).optional(),
    hidden: z.boolean().optional(),
  })
  .strict()
export const sectionsSchema = z
  .partialRecord(
    z.enum(sectionDefinitions.map((s) => s.id) as [string, ...string[]]),
    sectionCopySchema
  )
  .superRefine((data, ctx) => {
    for (const [id, value] of Object.entries(data)) {
      if (!value) continue
      const definition = sectionDefinitions.find((s) => s.id === id)
      if (value.body && !definition?.body)
        ctx.addIssue({
          code: "custom",
          path: [id, "body"],
          message:
            "Body replacement is available only for static company sections.",
        })
      if (value.hidden && !id.startsWith("home:") && !id.startsWith("page:"))
        ctx.addIssue({
          code: "custom",
          path: [id, "hidden"],
          message: "This section must remain visible.",
        })
    }
  })
export type SectionCopy = z.infer<typeof sectionCopySchema>
export function readSections(value: string): Record<string, SectionCopy> {
  try {
    return JSON.parse(value || "{}")
  } catch {
    return {}
  }
}
