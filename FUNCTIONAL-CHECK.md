# Functional verification — 10 October 2026

Local website: http://localhost:5173/  
Admin dashboard: http://localhost:5173/admin

## Results

- 52 unit/integration tests passed against the isolated PostgreSQL test database.
- Full Chromium suite: 17 tests passed. After fixing enquiry navigation, all three focused regression tests passed (18 distinct browser tests across these runs).
- All 48 published public routes checked at 320px: no horizontal page overflow, broken page images or browser runtime errors.
- Lint passed. Production build includes frontend and server TypeScript checks.

| Feature | Verified behavior |
| --- | --- |
| Navigation | Desktop/mobile menus, repeated navigation, keyboard Escape, breadcrumbs, internal route inventory and custom 404 |
| Services | All 15 records, every category filter, accurate counts, keyboard card navigation and detail links |
| Content discovery | Resource search/categories, portfolio filters and FAQ accordions |
| Project/contact forms | Required fields, real database persistence, enquiry reference and accurate email-configuration message |
| Consultation | Date validation, saved request/reference and explicit unconfirmed meeting status |
| Careers/newsletter | Saved applications/subscriptions; unsubscribe lifecycle covered by API tests |
| Admin | Login/logout, content creation/edit/deletion, article preview/publishing, section changes/visibility/restoration and actual metrics |
| Enquiry management | Status, notes, follow-up, deletion and CSV behavior |
| Videos | Original video playback/progression, native controls, transcript and click-to-load external players |
| Contact channels | Call link and WhatsApp target use the saved business number; no calls/messages were sent during verification |
| Access control | Sessions, permissions, CSRF/origin checks, private files and upload validation covered by integration tests |

## Fixes made

- Homepage hero no longer forces a minimum width larger than a narrow phone viewport. Action links and assurance text can wrap.
- Technology links use a compact vertical arrangement on narrow phones, removing the remaining horizontal overflow.
- Navigating from Contact to Request a Quote, or between enquiry types and selected services, remounts the form with the correct context. Previously a reused form could retain the old enquiry type.
- Enabled WhatsApp for **+91 70781 77772**, as confirmed by the owner, through the authenticated settings API. Persistence and rendered URL verified.
- Added regression tests for narrow layouts, service filters/counts/navigation, configured contact targets and enquiry context changes.

## External setup still required

- Business contact email has not been supplied. Transactional email also requires a verified email sender/provider and server-side credentials; adding a contact email alone does not enable delivery. Enquiries are saved in the admin dashboard regardless.
- No live booking-calendar URL is configured. Consultation requests work; confirmed availability/meeting bookings require a calendar integration.
- WhatsApp opens the configured chat; successful message delivery requires the number to have a working WhatsApp account. Calls require the visitor's phone/calling app.
- Local media storage works and is covered by integration tests. Production object storage and optional analytics are not configured or live-tested.

External video loading is exercised with intercepted provider responses. Email transport tests use mocks and do not prove live delivery. No public deployment was performed. Test records and temporary content changes were cleaned up by the test suites; actual contact settings remain saved.
