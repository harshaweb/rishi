# Historical business-site verification

These results precede the rental marketplace redesign. Current Havenly verification and remaining configuration are documented in [RENTAL-VALIDATION.md](./RENTAL-VALIDATION.md) and [RENTAL-SETUP.md](./RENTAL-SETUP.md).

# Functional verification — 11 October 2026

Local website: http://localhost:5173/  
Admin dashboard: http://localhost:5173/admin

## Verified results

- 67 backend, validation, rendering, upload, security and integration tests passed across 9 test files.
- All 19 Chromium browser tests passed. Four affected admin workflows passed again after the partial-update fix.
- All 5 production-build checks passed against the compiled application using an isolated test database.
- All 48 published public routes passed server rendering and SEO checks, and rendered at 320px without horizontal page overflow, broken images or browser runtime errors.
- Production build, TypeScript checks and lint passed. Clean dependency installation was verified in the repair checkout during MongoDB setup.
- A temporary local MongoDB replica set passed database initialization, seeded content/relations, admin login, persisted sessions, metrics, partial updates, enquiry submissions, newsletter subscriptions, applications, atomic rate limits, expiry and session revocation. This does not establish Atlas connectivity.
- Local backend health returned HTTP 200 with database connected.

## Functional coverage

| Area | Verified behavior |
| --- | --- |
| Navigation | Desktop/mobile menus, repeated navigation, keyboard access, internal links, custom 404 and consent preferences |
| Public content | All services and industries, service category filters, portfolio filters, resource search/categories and FAQ accordions |
| Enquiries | Required-field errors, database persistence, references, duplicate handling and accurate email configuration messages |
| Consultation | Date validation and saved request/reference; does not falsely confirm a meeting |
| Newsletter and careers | Saved subscriptions/applications, unsubscribe lifecycle and private resume access |
| Admin | Login/logout, metrics, section visibility/content/restoration, article preview/publishing and content CRUD |
| Content management | Create/search/update/publish/hide/delete industries, projects, categories, tags, FAQs, team members and jobs; service/article CRUD and audit trails |
| Enquiry management | Search, filtering, pagination, status changes, follow-up, notes, deletion and CSV safety |
| Security | Roles, CSRF/origin restrictions, invalid inputs, session cookies, disabled accounts and password-reset session revocation |
| Files | Upload validation, private file permissions, PDF restrictions and local storage |
| Videos/contact | Original video playback, transcript, controlled external embeds and correct call/WhatsApp links |
| Production rendering | Hydration, lazy pages, canonical URLs, sitemap, robots, private indexing and static-folder route conflicts |

## Issues found and fixed in this run

1. Static asset directories redirected `/portfolio` and `/videos` to trailing-slash paths that returned 404. Static directory redirects are disabled, and metadata/canonical generation accepts trailing slashes.
2. Partial admin updates applied defaults to omitted fields, unexpectedly unpublishing content and resetting other settings. PATCH now writes only supplied fields.
3. The same partial-update behavior could re-enable disabled staff accounts during name edits. Account state is preserved; regression checks also verify password changes revoke existing sessions.
4. Production browser checks now launch their own isolated compiled-server fixture and simulate HTTPS proxy headers when verifying secure cookies.

## Live deployment and external setup

The deployed https://rishi-amber-one.vercel.app/api/health still returned HTTP 503 during this run. Local success must not be represented as a working production deployment. The supplied MongoDB URI contains username/password placeholders; no real MONGODB_URL is configured locally. A real named Atlas database URL must be configured before cloud initialization and deployment. The Vercel project session secret and site URL were configured earlier, but the current deployed function still reports missing configuration until a deployment with all required settings is made.

- Business contact email and transactional email provider/sender credentials are absent. Enquiries are saved, but live email delivery is not enabled or verified. Email transport tests use mocks.
- No booking-calendar URL is configured. Consultation requests work; confirmed calendar bookings are not enabled.
- Production object storage is absent. Local uploads work; persistent Vercel uploads require configured object storage.
- External video embed responses are intercepted in browser tests. No calls, WhatsApp messages or real emails were sent. Call/message delivery depends on the visitor's application and the configured number's account.

Changes and verification are local; this report does not claim that these updates were pushed or deployed. Browser test submissions and temporary content are cleaned up by the suites; audit records remain as expected. No real business submissions were intentionally removed.
