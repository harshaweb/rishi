import type { RentalProperty } from "./rentals"
export const services = [
  [
    "website-development",
    "Website Design & Development",
    "A better first impression. A stronger digital foundation.",
    "Fast, accessible websites that communicate your value and make the next step effortless.",
    "Development",
    [
      "Responsive design built around your audience",
      "Content architecture and search-ready foundations",
      "Performance budgets and accessible interactions",
    ],
    [
      "Discovery and content mapping",
      "Design exploration and prototyping",
      "Development, quality checks and launch",
    ],
  ],
  [
    "web-applications",
    "Custom Web Application Development",
    "Software that works the way your business does.",
    "Purpose-built applications that connect your people, processes and data in one dependable experience.",
    "Development",
    [
      "Workflows designed around real operational needs",
      "Role-based access and thoughtful data modelling",
      "A maintainable foundation for future features",
    ],
    [
      "Workflow discovery",
      "Architecture and iterative development",
      "Acceptance testing and rollout",
    ],
  ],
  [
    "ecommerce",
    "E-commerce Website Development",
    "Turn browsing into a better buying experience.",
    "Distinctive storefronts with intuitive product discovery, dependable checkout and manageable operations.",
    "Development",
    [
      "Mobile-first product and checkout journeys",
      "Inventory, payment and shipping integrations",
      "Accessible catalogues that are easy to maintain",
    ],
    [
      "Catalogue and commerce planning",
      "Storefront and integration development",
      "Checkout testing and launch",
    ],
  ],
  [
    "mobile-applications",
    "Mobile Application Development",
    "Useful experiences. Wherever your customers are.",
    "Mobile products designed for everyday use, with focused journeys and a considered release strategy.",
    "Development",
    [
      "Platform-appropriate navigation and interactions",
      "Secure API integration and offline considerations",
      "Release planning and ongoing maintenance",
    ],
    [
      "Product scope and journey design",
      "App and API implementation",
      "Device testing and release preparation",
    ],
  ],
  [
    "saas-development",
    "SaaS Product Development",
    "From product idea to a platform built to evolve.",
    "Validate your core proposition and build a subscription product with a clear path beyond its first release.",
    "Development",
    [
      "Focused MVP scope and product architecture",
      "Tenant isolation and subscription workflows",
      "Observability and a practical scaling roadmap",
    ],
    [
      "Product definition and validation",
      "MVP development and pilot",
      "Launch, measurement and iteration",
    ],
  ],
  [
    "crm-erp",
    "CRM & ERP Development",
    "Less disconnected work. More operational clarity.",
    "Connected business systems that bring customer relationships, reporting and internal workflows together.",
    "Development",
    [
      "Shared customer and operational records",
      "Permissions, approvals and audit histories",
      "Migration and integration planning",
    ],
    [
      "Process audit and requirements",
      "Modules and data migration",
      "Staff onboarding and rollout",
    ],
  ],
  [
    "api-integration",
    "API Development & Integration",
    "Make your systems work together.",
    "Documented APIs and reliable integrations that move information securely between the tools you rely on.",
    "Development",
    [
      "Clear contracts and versioned endpoints",
      "Validation, authentication and rate controls",
      "Retries, monitoring and integration documentation",
    ],
    [
      "Integration mapping",
      "API implementation and contract testing",
      "Monitoring and handover",
    ],
  ],
  [
    "ui-ux-design",
    "UI/UX Design",
    "Clarity at every interaction.",
    "Research-informed digital experiences that make complex products feel understandable, useful and coherent.",
    "Design",
    [
      "Audience research and journey mapping",
      "Interactive prototypes for early validation",
      "Reusable, accessible design systems",
    ],
    [
      "Research and problem framing",
      "Wireframes and prototype evaluation",
      "Visual design and engineering handoff",
    ],
  ],
  [
    "ai-automation",
    "AI Integration & Business Automation",
    "Give your team more time for meaningful work.",
    "Practical automation and carefully evaluated AI integrations for repetitive, information-heavy workflows.",
    "Intelligence",
    [
      "Use-case evaluation before implementation",
      "Human review for consequential decisions",
      "Privacy, quality checks and cost visibility",
    ],
    [
      "Workflow and risk assessment",
      "Prototype and evaluation",
      "Controlled rollout and monitoring",
    ],
  ],
  [
    "digital-marketing",
    "Digital Marketing",
    "Connect your digital presence to business priorities.",
    "A coordinated approach to content, campaigns and measurement, guided by your audience and objectives.",
    "Growth",
    [
      "Audience and channel planning",
      "Consistent campaign messaging",
      "Transparent measurement and iteration",
    ],
    [
      "Baseline and audience research",
      "Campaign planning and execution",
      "Reporting and optimisation",
    ],
  ],
  [
    "google-ads",
    "Google Ads Management",
    "Be there when your audience is searching.",
    "Intent-focused search campaigns with clear account structure, relevant landing pages and accountable reporting.",
    "Growth",
    [
      "Keyword intent and negative keyword planning",
      "Conversion tracking subject to consent",
      "Budget controls and regular campaign reviews",
    ],
    [
      "Account and landing-page audit",
      "Campaign setup and launch",
      "Testing and ongoing refinement",
    ],
  ],
  [
    "meta-ads",
    "Meta Ads Management",
    "Creative campaigns built around your audience.",
    "Paid social strategies that connect audience insight, original creative and measurable campaign objectives.",
    "Growth",
    [
      "Audience and creative testing plans",
      "Consent-aware conversion measurement",
      "Budget pacing and understandable reporting",
    ],
    [
      "Audience and objective definition",
      "Creative development and campaign setup",
      "Performance review and iteration",
    ],
  ],
  [
    "seo",
    "SEO Services",
    "Build discoverability into your digital foundation.",
    "Technical, content and on-page improvements that help search engines understand your site and visitors find useful answers.",
    "Growth",
    [
      "Technical and content audits",
      "Useful page structure and internal links",
      "Reporting without ranking guarantees",
    ],
    [
      "Search and technical baseline",
      "Prioritised implementation",
      "Content and performance review",
    ],
  ],
  [
    "maintenance",
    "Website Maintenance & Support",
    "Keep your digital business moving.",
    "A planned approach to updates, monitoring and improvements, with support scope agreed around your needs.",
    "Support",
    [
      "Dependency updates and backup planning",
      "Monitoring and issue triage",
      "Documented support scope and handover",
    ],
    [
      "Website health review",
      "Maintenance plan and access setup",
      "Regular updates and reporting",
    ],
  ],
  [
    "it-consulting",
    "IT Consulting",
    "Make your next technology decision with confidence.",
    "Independent technical discovery and practical roadmaps that connect your systems to your business priorities.",
    "Strategy",
    [
      "Architecture and vendor evaluation",
      "Prioritised roadmap and cost considerations",
      "Security and operational readiness reviews",
    ],
    [
      "Stakeholder discovery",
      "Options and trade-off analysis",
      "Roadmap and implementation guidance",
    ],
  ],
].map(
  ([slug, title, headline, description, category, benefits, process], i) => ({
    id: `service-${i}`,
    slug: slug as string,
    title: title as string,
    headline: headline as string,
    description: description as string,
    category: category as string,
    benefits: benefits as string[],
    process: process as string[],
    body: "We begin by understanding your audience, business constraints and existing systems. Together, we define the outcomes, agree a practical scope and deliver in reviewable stages. You receive documented decisions, clear ownership and a plan for maintaining what we build.",
    published: true,
    seoTitle: "",
    seoDescription: "",
    order: i,
  })
)

export const industries = [
  [
    "ecommerce",
    "E-commerce",
    "Thoughtful shopping experiences, from discovery to delivery.",
    [
      "Product discovery and storefront design",
      "Inventory and fulfilment integrations",
      "Customer retention workflows",
    ],
  ],
  [
    "healthcare",
    "Healthcare",
    "Clear, accessible experiences for patients and care teams.",
    [
      "Appointment and enquiry journeys",
      "Accessible patient information",
      "Privacy-conscious operational workflows",
    ],
  ],
  [
    "education",
    "Education",
    "Digital tools that support learning and administration.",
    [
      "Course discovery and enrolment",
      "Learning portals and dashboards",
      "Institutional content platforms",
    ],
  ],
  [
    "real-estate",
    "Real Estate",
    "Help people find the right space and take the next step.",
    [
      "Property search and listing management",
      "Lead routing and CRM integrations",
      "Agent and project presentation",
    ],
  ],
  [
    "finance",
    "Finance",
    "Make complex information easier to navigate.",
    [
      "Secure customer portals",
      "Clear product and service information",
      "Permissioned workflows and audit records",
    ],
  ],
  [
    "professional-services",
    "Professional Services",
    "A digital presence as considered as your expertise.",
    [
      "Service-led websites",
      "Consultation and enquiry workflows",
      "Knowledge and resource libraries",
    ],
  ],
  [
    "startups",
    "Startups",
    "Turn your next idea into a focused first product.",
    [
      "MVP planning and validation",
      "Scalable application foundations",
      "Launch and iteration roadmaps",
    ],
  ],
  [
    "manufacturing",
    "Manufacturing",
    "Connect your catalogue, operations and business customers.",
    [
      "B2B catalogues and enquiry portals",
      "ERP and supply-chain integrations",
      "Operational reporting tools",
    ],
  ],
].map(([slug, title, description, benefits], i) => ({
  id: `industry-${i}`,
  slug: slug as string,
  title: title as string,
  description: description as string,
  benefits: benefits as string[],
  body: "Every organisation has different operational and regulatory requirements. We define those requirements with your team before selecting technology or proposing a solution. Our work connects clear user journeys with maintainable systems and documented handover.",
  published: true,
  seoTitle: "",
  seoDescription: "",
  order: i,
}))

export const projects = [
  {
    id: "project-0",
    slug: "forma-commerce",
    title: "Forma — a considered commerce experience",
    description:
      "A demonstration storefront exploring thoughtful product discovery, editorial storytelling and a focused shopping journey.",
    body: "This original demonstration concept shows how a lifestyle catalogue can combine a clear product hierarchy with a restrained editorial identity. The proposed scope includes catalogue filters, product detail pages, accessible interactions and payment-provider integration. This is an illustrative design study, not commissioned client work or a live commercial service.",
    industry: "E-commerce",
    services: ["UI/UX Design", "E-commerce Development"],
    technologies: ["React", "TypeScript", "PostgreSQL"],
    demo: true,
    cover: "commerce",
    published: true,
    gallery: [],
    url: "",
    results: "",
    seoTitle: "",
    seoDescription: "",
    order: 0,
  },
  {
    id: "project-1",
    slug: "orbit-workspace",
    title: "Orbit — operations, brought together",
    description:
      "A demonstration workspace concept for clearer tasks, team visibility and day-to-day operational decisions.",
    body: "An illustrative business workspace that organises tasks, approvals and activity into a coherent interface. The concept considers role-based access, searchable records and a documented API layer. No business results or client relationship are claimed.",
    industry: "Professional Services",
    services: ["Web Applications", "UI/UX Design"],
    technologies: ["React", "Node.js", "PostgreSQL"],
    demo: true,
    cover: "workspace",
    published: true,
    gallery: [],
    url: "",
    results: "",
    seoTitle: "",
    seoDescription: "",
    order: 1,
  },
  {
    id: "project-2",
    slug: "learnpath",
    title: "Learnpath — make room for learning",
    description:
      "A demonstration learning portal focused on clear course navigation and an approachable learner experience.",
    body: "A sample education product exploring course discovery, lesson organisation and progress visibility. The design study is intended to start conversations about learning needs and accessible delivery. It is not an operating institution or a completed client project.",
    industry: "Education",
    services: ["Web Applications", "UI/UX Design"],
    technologies: ["React", "TypeScript", "Node.js"],
    demo: true,
    cover: "education",
    published: true,
    gallery: [],
    url: "",
    results: "",
    seoTitle: "",
    seoDescription: "",
    order: 2,
  },
]
export const categories = [
  { id: "category-0", slug: "engineering", title: "Engineering" },
  { id: "category-1", slug: "strategy", title: "Digital strategy" },
  { id: "category-2", slug: "design", title: "Design" },
]
export const tags = [
  { id: "tag-0", slug: "planning", title: "Planning" },
  { id: "tag-1", slug: "accessibility", title: "Accessibility" },
]
export const posts = [
  {
    id: "post-0",
    slug: "planning-your-next-website",
    title: "A better website starts with better questions",
    description:
      "Before choosing a framework or a colour palette, get clear on what your website needs to do.",
    body: "## Start with the visitor\nA useful website starts with a specific audience. Write down who is visiting, what they need to understand and which action should follow. Interview people who regularly answer customer questions. Their answers often reveal gaps in the current content.\n\n## Define the practical scope\nSeparate launch requirements from later improvements. Map important pages and their owners. Identify any integrations, content migration or accessibility needs early so they can be planned properly.\n\n## Agree how you will evaluate the work\nUse concrete acceptance criteria: a complete enquiry reaches the right team, a visitor can find a service on mobile, and content can be maintained without unnecessary friction. Define measurement with appropriate consent and privacy controls.\n\n## Prepare for life after launch\nAssign responsibility for content, updates, backups and access. A website is an ongoing part of your business. A clear handover makes it easier to keep useful.\n\n*Editorial sample by Harshaweb. Adapt this article to your organisation’s approach before publication as official guidance.*",
    categoryId: "category-1",
    status: "PUBLISHED",
    cover: "strategy",
    featured: true,
    seoTitle: "",
    seoDescription: "",
    publishedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "post-1",
    slug: "accessible-design-foundations",
    title: "Accessible design is good product thinking",
    description:
      "Practical foundations for interfaces that more people can understand and use.",
    body: "## Make the structure clear\nUse meaningful headings, labels and landmarks. A visitor should be able to understand the page without relying only on its visual layout.\n\n## Design for the keyboard\nMake focus visible and use native controls. Check menus, dialogs and forms without a mouse. Avoid interactions that depend on hover alone.\n\n## Help people recover\nPut form errors near their fields and explain how to fix them. Keep entered values after a failed submission. Announce important status changes to assistive technologies.\n\n## Test in context\nAutomated checks are useful, but they do not replace keyboard and assistive technology review. Build accessibility into acceptance criteria and regular product checks.\n\n*Editable Harshaweb editorial sample. This article does not claim certification or an accessibility score.*",
    categoryId: "category-2",
    status: "PUBLISHED",
    cover: "design",
    featured: false,
    seoTitle: "",
    seoDescription: "",
    publishedAt: "2026-10-03T00:00:00.000Z",
  },
  {
    id: "post-2",
    slug: "when-custom-software-makes-sense",
    title: "When does custom software make sense?",
    description:
      "A practical way to weigh an off-the-shelf tool against a purpose-built application.",
    body: "## Describe the problem first\nDocument the workflow and the friction it creates. Compare the cost of changing the workflow with the cost of building and maintaining software.\n\n## Consider existing tools\nEvaluate whether a supported product can meet the core need. Include integration costs, user access, data export and operational ownership in the comparison.\n\n## Build where it matters\nCustom software may be appropriate where a distinctive workflow provides value that existing tools cannot reasonably support. Start with a focused scope, test assumptions and plan for ongoing maintenance.\n\n*Editable Harshaweb editorial sample.*",
    categoryId: "category-0",
    status: "PUBLISHED",
    cover: "engineering",
    featured: false,
    seoTitle: "",
    seoDescription: "",
    publishedAt: "2026-10-05T00:00:00.000Z",
  },
]
export const faqs = [
  [
    "How do we get started?",
    "Tell us what you want to achieve using the project enquiry form. We will review your brief and discuss goals, scope, constraints and a suitable next step.",
  ],
  [
    "Can you work with our existing website or application?",
    "Yes. The first step is a technical review of your current platform, access, code and operational requirements. We then agree whether an improvement, integration or rebuild is appropriate.",
  ],
  [
    "How much will my project cost?",
    "Cost depends on scope, integrations, design and ongoing support. Share your requirements and an indicative budget so we can prepare a proposal with clear deliverables and assumptions.",
  ],
  [
    "What happens after launch?",
    "We document the handover and agree any maintenance or support arrangement separately. That can include updates, monitoring, content assistance and a prioritised improvement roadmap.",
  ],
  [
    "Who owns the project and source code?",
    "Ownership, licensing and handover are defined in the project agreement. We discuss these details before work begins so responsibilities are clear.",
  ],
].map(([question, answer], i) => ({
  id: `faq-${i}`,
  question,
  answer,
  order: i,
  published: true,
  serviceId: null,
}))
export const settings = {
  sectionContent: "{}",
  announcement: "Good ideas deserve great execution. Let’s build yours.",
  heroEyebrow: "YOUR NEXT CHAPTER, BUILT BETTER",
  heroTitle: "Technology that moves your business forward.",
  heroDescription:
    "From high-performance websites to scalable applications and digital growth solutions. We turn ambitious ideas into dependable digital experiences.",
  contactEmail: "",
  contactPhone: "",
  contactPhone2: "",
  contactPhone2Hours: "",
  contactPhone3: "",
  contactPhone3Hours: "",
  presenceLocations: "",
  vision:
    "To make useful, dependable digital experiences accessible to businesses with ambitious ideas.",
  mission:
    "To connect thoughtful design, practical engineering and clear communication, helping each project move from a defined problem to a maintainable solution.",
  whatsappPhone: "",
  businessHours: "",
  bookingUrl: "",
  linkedinUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  video1Title: "From idea to launch",
  video1Url: "/videos/harshaweb-process.mp4",
  video1Description:
    "An original, silent Harshaweb overview of discovery, design, engineering and launch. Read the full transcript below the player.",
  video1Transcript:
    "A clearer path from idea to launch. Discover: understand the audience, goals and constraints. Design: make the structure clear and the experience accessible. Build: connect thoughtful interfaces with dependable engineering. Launch: review, document and plan the next step. Start your conversation at Harshaweb.",
  video2Title: "",
  video2Url: "",
  video2Description: "",
  video2Transcript: "",
  video3Title: "",
  video3Url: "",
  video3Description: "",
  video3Transcript: "",
  address: "",
  companyDescription:
    "Thoughtful design. Dependable engineering. Meaningful digital growth.",
  maintenanceNotice: "",
}
export const initialContent = {
  rentals: [] as RentalProperty[],
  services,
  industries,
  projects,
  posts,
  categories,
  tags,
  faqs,
  team: [] as Team[],
  jobs: [] as Job[],
  settings,
}
export type Team = {
  id: string
  name: string
  role: string
  bio: string
  photo: string
  order: number
  published: boolean
}
export type Job = {
  id: string
  slug: string
  title: string
  location: string
  type: string
  description: string
  body: string
  published: boolean
}
export type Content = typeof initialContent
export type Service = (typeof services)[number]
export type Project = (typeof projects)[number]
export type Post = (typeof posts)[number]
