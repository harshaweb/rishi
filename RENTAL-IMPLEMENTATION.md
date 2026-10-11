# Havenly rental marketplace

The existing React/Vite, Express, TypeScript and PostgreSQL application is retained. Business modules remain in source while the primary experience becomes an original vacation-rental marketplace. PostgreSQL is required for the rental engine's transactional inventory guarantees; the earlier MongoDB adapter is not used for reservations.

1. Inspect existing code, dependencies, environment and authentication. Complete.
2. Build the responsive travel layout, destination search, cards, details and navigation. Complete.
3. Add normalized rental schema/migrations, seed listings, guest accounts and verification/reset flows. Complete.
4. Implement database search, host ownership/moderation, availability and atomic nightly inventory. Complete.
5. Implement pending reservation expiry, host approval, Razorpay verification/webhooks/refunds and notifications. Complete; external providers require configuration.
6. Build guest, host and rental-admin workspaces. Complete.
7. Add database wishlists, private messaging, eligible reviews, safety controls and SEO. Complete.
8. Run type checks, lint, backend and browser checks; document actual results and external configuration. See RENTAL-VALIDATION.md.

Demonstration listings and hosts are labelled. No fabricated review scores are shown. Demo listings use explicit host approval/pay-at-property booking; no payment success is simulated. Experiences are a later phase and have no booking controls. Production email, payment, maps and S3 require real credentials.
