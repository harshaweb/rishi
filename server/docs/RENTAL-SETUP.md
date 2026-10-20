> Historical pre-MongoDB documentation. For the current two-folder layout, MongoDB setup and deployment commands, use ../../README.md and MONGODB-SETUP.md.

# Omshivraj rental marketplace

Original Airbnb-inspired implementation in the existing React/Vite, Express and PostgreSQL application. The previous business modules and their API tests are retained. Rental accounts are separate from staff accounts. No Airbnb logo, proprietary code or copied listing text is used.

## Local setup

Use Node 24 and the repository root. Run `npm ci`, copy `.env.example` to `.env`, configure PostgreSQL and a random session secret, then `npm run db:generate`, `npm run db:migrate`, and `npm run rental:seed`. `npm run setup:local` provisions the existing local PostgreSQL development environment when needed. Start with `npm run dev`; frontend is http://localhost:5173 and API is http://localhost:3001.

`rental:seed` is development/test only. It adds 32 explicitly labelled demo stays in Delhi, Gurugram, Noida and Ghaziabad and approved demo host/guest accounts. Random credentials are saved only in ignored `.data/rental-demo.txt`. Existing local administrators are copied to rental accounts by this development seed. No real ratings, verified-host badges, customer transactions or payments are invented. Demo stays are not real travel arrangements.

The marketplace serves Delhi NCR only: Delhi (including New Delhi), Gurugram (including Gurgaon), Noida, Greater Noida, Ghaziabad and Faridabad. Public discovery, property pages, quotes and new reservations exclude other cities. Host forms and publication/moderation validate the service area. Existing historical reservations remain accessible. `npx tsx scripts/region-demo.ts` updates only the previous local demonstration catalogue to the new area while preserving IDs and photos; it refuses production execution and never relocates real listings.

For production, do not run the demo seed. Provision your administrator using `npm run rental:admin` with ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD injected into that process. Passwords must be 12–72 characters; remove bootstrap variables after use. Create categories/amenities with `npm run rental:catalog`, approve a real host application, and review its listing before publishing.

## Routes and workflows

- `/`, `/search`, `/stays/:slug`: database search, combined URL filters, sorting/pagination, galleries, calendars, verified quotes, booking requests and host messages.
- `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`: hashed passwords, secure sessions, one-time email tokens and reset session invalidation. Development token links are never returned in production.
- `/profile`, `/wishlists`, `/trips`, `/messages`, `/notifications`: account editing, uploads, saved lists, reservation status/cancellation/reviews, private conversations and notifications.
- `/host`, `/host/listings`, `/host/listings/new`, `/host/listings/:id/edit`, `/host/listings/:id/preview`, `/host/calendar`, `/host/reservations`, `/host/earnings`, `/host/reviews`: administrator-approved hosting, draft editing, photos, rules, pricing/discounts, calendar blocks, approval requests, earnings records and review responses.
- `/admin` and `/admin/users`, `/admin/hosts`, `/admin/listings`, `/admin/bookings`, `/admin/payments`, `/admin/refunds`, `/admin/reviews`, `/admin/reports`, `/admin/categories`, `/admin/coupons`, `/admin/settings`, `/admin/audit`: protected marketplace operations, moderation, search, pagination and page CSV exports. Administrator role changes and financial actions require server authorization.
- `/help`, `/contact`, `/terms`, `/privacy`, `/cancellation-policy`: support and policy information. Support reports require an account and appear in administrator reports.
- `/experiences`: explicitly a later phase, without booking controls.

## Database and booking rules

Rental models and migrations are in `prisma/schema.prisma` and `prisma/migrations`. This marketplace requires PostgreSQL; unset MONGODB_URL. The preserved business app's Mongo adapter does not support rental inventory.

All amounts are integer paise, calculated on the server. Discounts apply to nightly subtotal; the larger of the property discount and valid coupon is used, not both. Fee and tax basis points are administrator-controlled. Booking prices, booking method and cancellation policy are snapshotted. Calendar DATE values retain their day across timezones.

Each occupied night has a unique `(propertyId, night)` inventory key. Property-level locking and transactions protect reservation creation and blocks. Checkout is exclusive, so adjacent stays work. Pending online-payment holds expire after 20 minutes; host-approval requests after 48 hours. Availability ignores expired holds immediately; subsequent booking/dashboard reads release their inventory. For predictable background cleanup, run `npm run rental:expire` from your scheduler every five minutes.

HOST_APPROVAL stays are confirmed only when their owner accepts; payment is due at the property and is never recorded as online revenue. PAYMENT stays require configured Razorpay credentials, a server-created order and a captured provider payment with exact order, INR currency and amount. Orders, callbacks and webhook processing are idempotent. Late captures cancel the expired reservation and record a full refund request rather than stealing inventory from another guest.

## External service configuration

Required for production: DATABASE_URL (managed PostgreSQL), SESSION_SECRET (random 32+ characters), SITE_URL (your actual HTTPS deployment origin), NODE_ENV=production, TRUST_PROXY=1 only behind the trusted deployment proxy. Vercel uses the existing root `vercel.json`, Node24, `npm run build:vercel`, `dist`, and Express API fallback. Apply migrations separately with production database credentials before enabling traffic. No credentials are committed.

Payments: set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET. Start with Razorpay test credentials, enable capture, configure webhook URL `https://YOUR_DOMAIN/api/rental/payments/webhook`, and subscribe to `payment.captured` and `refund.processed`. The callback verifies HMAC over order ID and payment ID, then retrieves the payment through Razorpay's server API. Webhooks verify the raw body. No card details touch this database. Switch to live keys only after real test-provider checkout, cancellation and webhook retries are verified. Automated provider tests use explicitly mocked responses, not live charges.

Refunds: cancellation records the policy amount; administrator processing calls Razorpay. PROCESSED webhooks update refund status. If an outbound refund fails ambiguously, the record becomes RECONCILE_REQUIRED, preventing a blind duplicate refund. Reconcile it against provider records before making a correction. Payout automation, connected-host bank onboarding and tax remittance are not implemented; earnings are records, not bank payouts.

Email: set RESEND_API_KEY and a verified EMAIL_FROM. Verify your sending domain in Resend. Without these, development offers local verification/reset links and records NOT_CONFIGURED notifications; production does not expose tokens and verification-dependent booking cannot be completed until email is configured. PROVIDER_ACCEPTED means accepted for sending, not proven inbox delivery.

Phone sign-in SMS: the rental login and signup forms send one-time codes through Twilio Programmable Messaging. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER` as server-only environment variables in `.env` locally and in the hosting provider for production. Never add them to a `VITE_` variable or commit real values. Restart the API after setting them. Without credentials, development displays a test OTP on the sign-in form; production rejects OTP requests and does not pretend an SMS was sent. Use a Twilio sender enabled for the recipient destinations and follow the setup requirements shown in the Twilio console. The application expires codes after 10 minutes, limits each code to five verification attempts and rate-limits code requests.

Uploads: production requires S3_BUCKET, S3_REGION and AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (or workload credentials); S3_ENDPOINT is optional for compatible storage. The existing media endpoint serves private-bucket objects. Development uses ignored `.data/uploads`. Images are limited to 4MB and PNG/JPEG/WebP with binary type validation. Removing a listing photo removes its association; retained media objects need an operator retention policy to avoid deleting shared assets.

Maps: MAPBOX_PUBLIC_TOKEN is a restricted public token; restrict allowed origins in Mapbox. The map view embeds Mapbox around result coordinates when configured. Without a token, the UI says maps are not configured and offers real OpenStreetMap location links. Advanced interactive markers and clustering are not implemented. English/INR are currently the supported locale and currency, disclosed in the selector.

## Verification

`npm run test:prepare` creates the isolated loopback harshaweb_test database. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (with local dev server and rental demo seed), and `npm run test:production` (self-started isolated production fixture). Backend tests include races, ownership, authentication, inventory, signatures, refunds and reviews. The active E2E suite is `tests/e2e/rentals.spec.ts`; prior business-only E2E specifications are retained as historical coverage and are not the rental suite.

Before public launch, replace demo inventory with real approved properties, configure your legal/company details and support operation, validate the configured live services and backups, and run a provider test checkout against your deployed HTTPS origin. This implementation has not charged a real customer or been deployed as part of this task.

## Photography

Locally bundled demonstration photography comes from Unsplash (https://unsplash.com/license). Source image IDs and URLs are listed in `public/stays/CREDITS.md`. Photography illustrates design only; it does not establish a real property or its location.
