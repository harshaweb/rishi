> Historical pre-MongoDB documentation. For the current two-folder layout, MongoDB setup and deployment commands, use ../../README.md and MONGODB-SETUP.md.

# Harshaweb validation and handover

## Website section management — October 10, 2026

Added 60 registered section controls in `/admin/sections`, with administrator-only APIs, database persistence and audit records. Section text and visibility render on the client and server. Static company and separate policy content support Markdown; collection/form bodies use their dedicated editors. Site settings saves preserve independently edited section content. Homepage service cards now use their saved service titles.

Validation: 52 tests in seven Vitest files passed, covering section schemas, server rendering, Markdown safety, persistence and permissions. The final full Chromium suite passed all 15 tests, including saving a homepage heading, observing it on the public site, hiding that section and restoring the original. The first full run had one blank-page route-inventory failure while a build ran concurrently; the isolated route-inventory rerun and subsequent full run both passed. Production build and lint passed. Desktop/mobile dashboard screenshots and checks passed; the existing call number remained configured. Local test content was restored after verification.

Validated locally on Windows on 10 October 2026, using Node.js 24, Chromium, and a real PostgreSQL database. This is a working source application; no public deployment or domain change was performed.

## Implemented

- Original responsive navy, white and electric blue design, desktop dropdowns, mobile navigation, keyboard focus, reduced-motion support, and original graphics.
- All requested main pages, 15 service pages, 8 industry pages, demonstration portfolio details, resources and articles: 48 seeded public routes plus a custom missing-page view.
- Original process video, click-to-load YouTube/Vimeo support with transcripts, video library, floating contact menu, configurable WhatsApp/call/email/directions/social links, consultation requests and an HTML sitemap.
- Persistent enquiries with references, validation, consent, deduplication, honeypot and database-backed rate limits; careers applications and newsletter subscriptions/unsubscribe.
- Protected admin/staff workspace with actual database metrics, lead follow-up/notes/export, content CRUD, publishing, categories/tags, private applications, subscriber management, media, settings, users/roles and audit history.
- PostgreSQL schema/migration/seed, password hashing, server-side sessions, CSRF and origin checks, private-data authorization, safe errors and upload validation.
- Production server rendering, unique metadata/canonicals, Open Graph, structured data, sitemap, robots and private-page indexing controls.
- Configurable transactional email, private S3-compatible storage and consent-gated analytics. Their live external connections require operator credentials.

## Executed checks

| Check | Result |
| --- | --- |
| PostgreSQL migration and initial seed | Applied successfully; later starts preserve content edits |
| `npm test` | 48 tests passed across 6 files |
| `npm run test:e2e` | All 13 browser tests passed |
| `npm run build` | Passed, including strict frontend/server TypeScript checks and Vite production bundling |
| `npm run lint` | Passed without errors or warnings |
| `npm audit --omit=dev` | 0 vulnerabilities reported |
| Local development restart | Verified shutdown frees ports and a fresh `npm run dev` starts database, API and frontend |
| Retention command, preview only | Executed successfully; no expired closed records selected |

Unit/integration coverage includes actual database persistence, invalid and duplicate submissions, rate limits, origin/CSRF protection, unauthorized access, staff permissions, disabled accounts, sessions/logout, lead updates, CSV escaping, service/blog CRUD, publication scheduling, newsletter lifecycle, safe errors, public images/private résumés, active PDF rejection, safe Markdown and provider email acceptance/partial/failure handling. Email tests mock transport; they do not establish live delivery.

Rendering tests execute the shared production document renderer directly, check all seeded public routes, and verify metadata escaping, safe hydration JSON, structured data and missing-page handling. Browser tests exercise desktop/mobile navigation, internal route discovery, form validation and persistence, resource search/category filtering, portfolio filtering, FAQs, newsletter and careers forms, login/logout, article preview/publish/edit/delete, lead notes/status/follow-up/delete, consent controls and 404 UI.

Desktop (1440 px) and mobile (390 px) screenshots are saved in `.data/screenshots/` and were visually reviewed. No Lighthouse, Core Web Vitals, WCAG conformance, penetration-test or delivery score is claimed.

## Before a public launch

1. Supply verified business/legal/contact information. Team and vacancy lists intentionally begin empty. Replace or explicitly retain labelled demonstration projects and editable sample articles. Review the draft policies, jurisdiction and retention periods.
2. Provision managed PostgreSQL with separate migration/runtime privileges, private object storage, HTTPS hosting and backups. Test restoring both database and media.
3. Configure a verified email sender and recipients; confirm actual visitor/admin delivery and failure handling. Configure and exercise S3 uploads/downloads/deletion.
4. Configure analytics identifiers only after reviewing the consent policy and tags, then verify consent and real collection.
5. Create a production administrator with `npm run admin:create`. Never deploy local `.env`, `.data`, test credentials, local operator password files or development PostgreSQL.
6. Run the provided production HTTP/browser suite (`npm run test:production`) on staging, then validate domain/TLS, secure cookies, headers, sitemap, SSR hydration and uploads on that environment.

Starting the separate production-mode verification server was rejected by automatic approval review as blocked by policy. The direct production-renderer tests passed; the separate production HTTP/browser suite was not executed. Docker container execution was also unavailable because the Docker daemon was not running.

The development dependency audit still reports high-severity advisories in the shadcn CLI dependency chain. The CLI is excluded from runtime dependencies; the production-only audit reports zero. Review and update the development tooling before using its affected functionality with untrusted input. No forced breaking downgrade was applied.

Local setup, admin bootstrap, deployment, backup, migration and troubleshooting instructions are in `README.md`. Local credentials are generated randomly and kept only in ignored files. The local operator credentials are in `.data/local-admin.txt`.

## Final verification

Footer expansion: Company, Help & support, Our Presence and Contact Us sections plus the Vision & Mission page were verified in Chromium at 1440 px and 390 px. Links resolved to the intended local pages, no horizontal overflow or browser errors were observed, and screenshots were saved. All 48 unit/integration tests, production build and lint passed after this change. The 13-test browser suite below was run before the footer expansion; the focused footer browser verification was run afterward.

After the contact/video expansion, the unit/integration run passed all 48 tests. The full Chromium run passed all 13 browser tests in 1.2 minutes. The three engagement tests also passed in a separate screenshot run. Playback duration/progression, mobile overflow, transcripts, contact link targets, Escape keyboard behavior, external-player loading only after a click, consultation date validation/persistence, admin settings persistence, unsafe URL rejection and staff restrictions were exercised. External player responses were intercepted in browser tests; live third-party account operation is not claimed. The production build and lint passed. The runtime dependency audit reported zero vulnerabilities; the full audit reported seven high-severity development-tool advisories in the shadcn CLI chain.

The local site was restarted on the user's request and is available at `http://localhost:5173`; visit `/admin` for the staff workspace, `/videos` for the video library and `/book-a-consultation` for consultation requests. On later sessions, run `npm run dev` from this directory. The persisted local database remains in `.data/postgres`. Verified business contact details, social/video links and a live external booking calendar still require the operator's information; blank optional channels remain hidden.
