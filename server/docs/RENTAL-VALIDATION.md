> Historical pre-MongoDB documentation. For the current two-folder layout, MongoDB setup and deployment commands, use ../../README.md and MONGODB-SETUP.md.

# Havenly validation — 11 October 2026

Implemented in `C:/Users/Harsh singh/Documents/rishi`. Development frontend and API are running at http://localhost:5173 and http://localhost:3001. PostgreSQL migrations have been applied locally; tests use the separate `harshaweb_test` database.

## Observed final results

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed; also part of the build |
| `npm test` | 88 tests passed across 10 files |
| Rental-specific backend tests | 21 passed, included in the 88 |
| `npm run build` | Passed, including the Express server bundle |
| `npm run test:e2e` | 5 passed |
| `npm run test:production` | 5 passed |
| Prisma schema validation | Passed |
| Prisma generation | Passed to an isolated ignored output directory to avoid the running Windows client's DLL lock |
| Narrow property page | Actual demo stay inspected at 390px; no horizontal overflow; availability calendar present |

The final browser suites use separate output folders to avoid trace-file collisions. An attempted extra dashboard lazy boundary caused a production hydration recovery; it was removed and production checks passed again. No runtime errors were accepted or filtered out of the production assertions.

Backend coverage includes registration, one-time email verification, wrong-password rejection, password reset and session revocation, CSRF, private and administrator authorization, approved-host onboarding, draft editing and approval reset, combined search filters, wishlist ownership, private message ownership, invalid dates, server prices, concurrent overlapping booking attempts, checkout-exclusive adjacent stays, expiry, blocked dates, host approval, cancellation reasons, review eligibility and uniqueness, image binary validation/reordering/removal, signed payments, server-captured amounts, concurrent payment-order reuse, agreed-policy snapshots, late captures/refunds and authenticated webhook deduplication.

Browser coverage includes destination autocomplete, dates/guest controls, filters, carousels, gallery dialogs and Escape, login, wishlists, server quotes, request/cancellation, private messages, profile, host workspaces, all administrator sections, and public/account mobile navigation. Production coverage includes retained public pages, server-rendered headings and unique metadata, image loading and 320px layouts, sitemap/robots/404 controls, trailing-slash asset routes, hydration and secure response/session headers.

## Practical limits

- Razorpay responses in automated tests are explicit mocks. No live card charge, live refund, deployed webhook delivery or bank payout was performed.
- Live payment/email/map/storage services require the credentials listed in `.env.example` and RENTAL-SETUP.md. Email acceptance does not prove delivery.
- Demo stays and hosts are labelled and are not real verified rental inventory. No fake customer reviews or sales are presented.
- Experiences are a later phase. English and INR are supported; additional locales/currencies and host bank payouts are not implemented. Mapbox currently embeds a neighbourhood map; marker clustering is not implemented.
- Listing-photo deletion removes the association; shared storage assets need an operator retention policy.
- Vite emits a non-blocking chunk-size warning for the retained application bundle (approximately 628 kB minified / 168 kB gzip). Build and browser checks passed.
- This work has not been pushed or deployed. Production needs a managed PostgreSQL URL, real approved properties, configured providers, operator policies/support, and a real provider test checkout against the HTTPS deployment.

See RENTAL-SETUP.md for routes, commands, production administrator bootstrap, expiry scheduling, required environment variables and deployment instructions.
