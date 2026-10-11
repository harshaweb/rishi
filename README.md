# Harshaweb

A complete business website built on the existing **Vite, React, TypeScript, Tailwind and shadcn** project. Express provides authenticated APIs and production server rendering. PostgreSQL and Prisma persist public content, private submissions, sessions and administrative audit records.

## Start locally

Requires Node.js 24 and npm. From this directory:

```sh
npm ci
npm run dev
```

On the first run, the development launcher creates an **ignored `.env` with random credentials**, starts a loopback-only PostgreSQL database, generates the Prisma client, applies migrations and seeds editable content. Open **http://localhost:5173**. The API listens at **http://127.0.0.1:3001**. Stop with Ctrl+C; `.data/postgres` retains the database for the next run.

The optional embedded PostgreSQL package is development-only. Its JavaScript wrapper is a beta distribution of native PostgreSQL binaries. Production uses a separately managed PostgreSQL database; it must never run the local development launcher.

If `.env` already exists, it is preserved. Use `.env.example` for a managed/local external database and set `LOCAL_POSTGRES=0`. For Docker PostgreSQL, set a strong `POSTGRES_PASSWORD`, start Docker Desktop, run `docker compose up -d postgres`, and set the matching `DATABASE_URL`. Docker was not available for container validation in this workspace.

## Admin access

For this generated local environment:

```sh
npm run admin:local
```

This creates one local-only operator with a randomly generated password. Read **`.data/local-admin.txt`** and open **http://localhost:5173/admin**. The file is ignored and should never be shared or deployed.

For a real installation:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run admin:create
```

The bootstrap command prompts for an email, name and hidden password of 12–72 characters. Non-interactive provisioning can inject `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` through a secret manager. The command creates a user; it does not overwrite existing users or reset passwords. Remove bootstrap secrets from the process environment afterward. There is **no public registration endpoint**.

Administrators can create staff, change roles, disable accounts and reset passwords. Users cannot disable/demote their own administrator account. Password changes invalidate that user's stored sessions. An authorised administrator resets a forgotten password; retain a second securely managed admin account or database recovery procedure.

## What is implemented

### Manage the website

Open `/admin` and sign in with the local account from `.data/local-admin.txt` (keep this ignored file private). **Website sections** provides 60 registered section controls: page headings, homepage section introductions and visibility, header button text, footer consultation/newsletter copy, shared calls to action, static company content and separate policy bodies. Blank overrides preserve original text. **Restore original content** clears the chosen overrides when saved. Static body replacement supports safe Markdown; dynamic forms and collection sections do not support body replacement.

Use the dedicated **Services, Industries, Portfolio, Articles, Categories, Tags, FAQs, Team, Careers** and **Media library** editors for collection records and uploads. **Site settings** manages the homepage hero, announcement, company description, contact numbers/hours/address, presence, social links, vision/mission and videos. **Enquiries, Applications** and **Subscribers** manage saved submissions. Administrator-only **Staff & access** and **Audit trail** control accounts and record changes. Section changes persist in PostgreSQL and render on both the client and production server.

The section editor controls existing layout sections; it is not a drag-and-drop layout builder. Headings/introduction overrides apply only where those elements exist in a section. Header navigation destinations and the component layout remain defined in code. Public visitors cannot write section content, and staff cannot access administrator-only section editing.

- Homepage, company/team/process pages, 15 service pages, eight industry pages, technologies, portfolio listing/details, resource listing/articles, contact, quote, careers, policies and a custom 404.
- Desktop and mobile navigation, keyboard-operated dropdowns and native FAQ accordions, breadcrumbs, portfolio/service filters, resource search/category/tag filters and pagination.
- Quote/contact/service enquiry forms with client/server validation, a honeypot, persistent rate limits, unique references, duplicate handling, consent records and accurate email status.
- Separate website, application and marketing enquiry routes at `/enquiry/website`, `/enquiry/application` and `/enquiry/marketing`.
- Career applications, optional private PDF résumés, newsletter consent and token-based unsubscribe.
- Admin metrics from actual records; enquiry search/status filters, pagination, status updates, notes, follow-up dates, deletion and CSV export (up to 10,000 matching records per export).
- CRUD for services, industries, projects, articles, categories, tags, FAQs, team and job postings. Safe Markdown editing/preview, draft/published states and scheduled visibility using a future publication time.
- Application review/status/deletion, subscriber management, image uploads/deletion, editable homepage/contact settings, staff/role management and audit trail.
- Production SSR, unique page metadata/canonicals, Open Graph, XML sitemap for published records, robots.txt, noindex for private routes and accurate Organization/Service/Breadcrumb JSON-LD.

Seeded projects are **clearly labelled demonstration concepts**, not client work. Articles are **editable editorial samples**. No testimonials, client results, team identities, awards, certifications, company metrics, phone numbers or business addresses are fabricated. Enter verified contact information in **Admin → Site settings**. Team and job listings are empty until verified content is added.

`db:seed` only inserts missing initial content and does not overwrite edits. Re-running it can recreate a deleted seed record; do not run it automatically on every production release. The development launcher seeds only when site settings are empty, preserving later edits and deletions across restarts.

## Structure

```text
src/                 Responsive React pages, components and API client
shared/              Original seed content, route inventory and SEO metadata
server/              Express API, sessions, validation, email, storage and SSR
prisma/schema.prisma Normalized PostgreSQL schema
prisma/migrations/   Versioned schema, session and rate-limit tables
prisma/seed.ts       Repeatable seed, without private submissions or users
scripts/             Local setup, bootstrap, test database and retention helpers
tests/               Vitest integration/unit tests and Playwright browser tests
public/              Original vector branding and social preview assets
```

## Tests and builds

Keep the development server/database running in another terminal:

```sh
npm run test:prepare
npm test
npx playwright install chromium
npm run admin:local
npm run test:e2e
npm run typecheck
npm run build
```

`test:prepare` creates **harshaweb_test**, an isolated database on the local cluster, and writes ignored test credentials. Unit/integration tests refuse to run against the main database. Browser tests use the local development site, create clearly prefixed test submissions and remove those test submissions after completion. They must never target a production site.

Production rendering checks use `npm run test:production` against a separately started production build at `127.0.0.1:4173`. Set `NODE_ENV=production`, `SITE_URL=https://www.harshaweb.com` and `PORT=4173` in that process. These tests verify server-rendered content and metadata, sitemap, 404 HTTP status, hydration and security headers. See `VALIDATION.md` for executed results and limits.

On Windows, stop running API processes before `db:generate` or dependency operations that regenerate Prisma: Windows locks the loaded native query engine. Ordinary builds intentionally do not regenerate the client. After editing the Prisma schema, generate a migration with `prisma migrate dev --name <change>`, review its SQL and regenerate the client with the API stopped.

## Videos, contact options and booking

The footer includes Company, Help & support, Our Presence and Contact Us sections. Vision & Mission is a real page at `/vision-and-mission`. Site settings control its copy, verified presence locations (one per line), three contact numbers with individual hours, WhatsApp, address and email. Blank contact fields and unverified locations are not fabricated. Help links accept online enquiries without claiming round-the-clock staffed support.

The homepage and `/videos` include an original 24-second silent Harshaweb process video with native playback controls and an accessible transcript. The source asset is `public/videos/harshaweb-process.mp4`; its optional authoring script is `scripts/generate-brand-video.py` (Pillow and imageio-ffmpeg required only to regenerate it).

In **Admin → Site settings**, configure up to three video titles, descriptions, links and transcripts. Supported sources are YouTube, Vimeo, or local `/videos/name.mp4` / `.webm` files. Arbitrary embed HTML and unapproved video providers are rejected. External players are created only after a visitor clicks play; no external thumbnails or player requests load beforehand. Clicking play connects the browser to that provider. Supply accurate text transcripts for every published video.

Site settings also control verified phone/email, WhatsApp number, business hours, address, optional HTTPS booking calendar link, and LinkedIn/Instagram/Facebook/YouTube profiles. Blank optional channels are hidden. Phone, WhatsApp, mail, directions and social links open the appropriate external service; these integrations do not automatically send messages or place calls. No BinaryClues contact details or accounts are used.

The floating contact menu is keyboard operable and closes on Escape. `/book-a-consultation` saves a real enquiry with the visitor's requested time and browser timezone. It provides an enquiry reference and explicitly states that the meeting is **not confirmed**. A configured external booking calendar can be used for live availability and confirmed bookings; external calendar availability and delivery are not verified here. `/site-map` provides a browsable list of published pages in addition to the XML sitemap.

The BinaryClues reference also promotes its own contact-data products, extractor software and reseller partnerships. Those proprietary products, data inventories, prices and partnership claims have not been copied or fabricated for Harshaweb. Harshaweb retains its own web/app/IT business and original content.

## Transactional email

Set `RESEND_API_KEY`, `EMAIL_FROM` and `ADMIN_NOTIFICATION_EMAIL`. Use a verified sender domain. A saved enquiry triggers a visitor confirmation and an admin notification containing its reference. Email is sent server-side only, with idempotency keys and timeouts. Missing configuration yields `not-configured`; both requests failing yields `failed`; one accepted request yields `partial`; both accepted requests yield `provider-accepted`. **Provider acceptance does not prove delivery.** Enquiries are saved even if notification sending fails. Applications currently save without email, and the UI says so. Newsletter subscription management does not automatically send campaigns.

Live email delivery has not been verified because credentials were not supplied. Test the verified sender, both recipients and failure handling in staging before launch.

## Media

Development files are saved under ignored `.data/uploads`. Production uploads require a private S3-compatible bucket: configure `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT` and standard AWS credentials or workload identity. Use bucket encryption, deny anonymous access, and grant only the required get/put/delete permissions.

Admin uploads accept one PNG/JPEG/WebP image up to 5 MB with alternative text. MIME types are checked against file signatures. `/media/:id` serves only assets explicitly marked public. Résumés accept PDF only, reject common active-content indicators and are downloadable only through an authenticated staff endpoint as attachments. These checks are not antivirus scanning; add an approved malware-scanning service before accepting uploads in an untrusted high-volume production environment. Résumés are removed with their application. Images referenced by content cannot be deleted until unlinked.

Live S3 access has not been verified because credentials were not supplied.

## Analytics and conversion measurement

Optional `GA4_MEASUREMENT_ID` or `GTM_CONTAINER_ID` values are validated server-side. No Google script loads before explicit optional consent. If both are set, GTM takes precedence. Route changes generate page-view events with **pathname only**, excluding query strings. Successful new enquiries emit `generate_lead`; subscriptions emit `newsletter_signup`; no submitted contact fields are included. GTM should map `virtual_page_view` and these events in a reviewed container. Advertising consent remains denied by default. Reset preferences on the Cookie Policy page.

No measurement IDs were supplied, so live collection has not been verified. Review configured tags, data recipients, policy text and consent obligations before enabling tracking. Reference: [Google tag installation](https://developers.google.com/tag-platform/gtagjs).

## Production deployment

Use a Node-compatible host (for example a container service, Render or Railway) with managed PostgreSQL and private object storage. This app requires a persistent Node server; deploying `dist` alone loses the API and SSR. The existing Vite setup was intentionally preserved instead of switching the repository to Next.js. Vercel would require adapting the Express server to that platform's serverless model.

1. Provision a managed PostgreSQL database and separate migration/runtime roles. The runtime role needs CRUD on application, Session and RateLimit tables, plus sequence access; it does not need schema-changing or superuser privileges.
2. Set a production `DATABASE_URL`, a cryptographically random `SESSION_SECRET`, `NODE_ENV=production`, `SITE_URL=https://www.harshaweb.com`, and the host's `PORT`. Set `HOST=0.0.0.0` inside a container.
3. Install with `npm ci`, then run `npm run db:generate` and `npm run build`.
4. Run reviewed migrations with `npm run db:migrate` using the migration role. Seed only the first installation and bootstrap an administrator securely.
5. Configure private storage and verified email. Replace all sample content that should not go live. Publish verified legal/entity/contact details and reviewed retention/privacy/terms.
6. Start with `npm start`. Terminate HTTPS at a trusted reverse proxy; redirect HTTP to HTTPS. Set `TRUST_PROXY=1` only when exactly one trusted proxy fronts the app and direct access is blocked. Secure session cookies require HTTPS.
7. Validate `/api/health`, forms, staff access, actual mail delivery, uploads, backups, sitemap, mobile navigation and domain/TLS before announcing launch.

The Dockerfile provides `build`, `release` (migrations) and `runtime` targets. Never embed `.env` or secrets in the image. Run the migration target as a one-off release job with the migration database role, then run the runtime image with the least-privilege role. Container execution was not tested because Docker Desktop was unavailable. No domain change or public deployment has been performed.

## Backups, recovery and data lifecycle

- Enable automated managed PostgreSQL backups and point-in-time recovery, with access and retention matching your policy. Back up the object store separately and keep database/media references consistent.
- Test restoring into a separate environment before relying on backups. An emergency restore must include session-secret rotation and session invalidation if access may have been compromised.
- Keep reviewed migration SQL in version control. Apply forward migrations in a release job. Back up before a destructive migration; do not run development resets against production.
- `npm run retention` previews expired **closed** enquiries and applications. `npm run retention -- --apply` deletes eligible records and their résumé files and records a retention audit event. Configure `LEAD_RETENTION_DAYS` and `APPLICATION_RETENTION_DAYS` only after deciding your obligations. Active records are excluded. Database failures are reported; orphaned object deletion failures require operator remediation.
- Handle identity-verified privacy requests through authorised admin deletion. Unsubscribe disables a newsletter record; administrators may permanently delete it. Coordinate deletion with backup retention, email providers and object-store versioning. Audit logs record entity IDs/actions rather than copies of submission content.
- Session expiration is enforced by the session store; expired rate-limit rows are removed by the retention command.

## Troubleshooting

- **Ports in use:** stop the previous owned development process. The database uses `55432`, Vite uses `5173`, and the API uses `3001`. Do not start duplicate local clusters.
- **Database unavailable:** start `npm run dev`, verify `DATABASE_URL`, and check `/api/health`. The API returns a real failure; forms do not invent success.
- **Windows Prisma EPERM:** stop the API before regenerating the Prisma client, then restart development.
- **Login fails:** ensure the administrator was bootstrapped, the account is active, and email/password match. Clear stale sessions after changing `SESSION_SECRET`. On production use HTTPS and correct trusted-proxy settings.
- **403 on form submit:** `SITE_URL` must match the browser origin. Development also allows the documented loopback origins. Admin mutations require a current CSRF token.
- **Upload unavailable in production:** configure object storage and bucket permissions. Avoid changing bucket/prefix configuration without migrating existing files.
- **Email saved but not delivered:** inspect the saved email status and the provider dashboard. Configure all three email variables and a verified sender; provider acceptance is not delivery confirmation.
- **An article is missing:** check its publication status and date. Future-dated posts stay out of the public API and sitemap until the time arrives.
- **Content edit conflicts:** slugs/emails must be unique, and related records must exist. The API reports conflicts; choose another value or update the relationship.

The local application is working and testable. Production readiness still depends on real hosting credentials, verified company information, reviewed policies, external-service verification and operator deployment checks. No accessibility or performance score is claimed.
