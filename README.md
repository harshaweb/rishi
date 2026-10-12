# Omshivraj

Delhi NCR rental marketplace with a React/Vite frontend and an Express/MongoDB backend.

## Project folders

- `frontend/src` — pages, components, styles, client API calls and account/admin UI.
- `frontend/public` — property photos, gallery images and public assets.
- `frontend/tests` — browser tests.
- `server/src` — API, authentication, MongoDB collections, booking transactions, payments, uploads and server rendering.
- `server/shared` — shared types and validation data imported by both applications.
- `server/scripts` — development, build, database checks, admin creation and migration tools.
- `server/prisma/schema.mongodb.prisma` — MongoDB schema for the retained content-management features. Rental marketplace storage uses the native MongoDB driver.
- `server/api` — Vercel function entry point.
- `server/tests` — API and integration tests.

Root files coordinate installation, builds and deployment. Install dependencies once from the repository root with `npm ci`.

## Development

Copy `.env.example` to `.env`, supply `MONGODB_URI` and a random `SESSION_SECRET`, then run:

```sh
npm run db:generate
npm run db:migrate
npm run rental:catalog
npm run dev
```

Frontend: http://localhost:5173 · API: http://localhost:3001

For isolated local development without Atlas access, run `npm run dev:local`. This starts a persistent MongoDB replica set on loopback port 27018, preserving data in ignored `.data/mongodb`. It does not modify the Atlas URL in `.env`. If the previous local PostgreSQL database is explicitly configured, its records are copied once/idempotently without deleting or overwriting either database. Existing local account passwords are retained. PostgreSQL compatibility code remains available during migration; it is not used for MongoDB requests.

MongoDB must be an Atlas cluster or replica set: booking inventory relies on transactions. If Atlas cannot connect, verify cluster status, database-user permissions, Network Access rules and the full URI. Never disable TLS validation.

## Admin

Set `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` privately, then run `npm run rental:admin`. Passwords must contain 12–72 characters; no default production password is included. Sign in at `/login`, then open `/admin`. Remove bootstrap secrets after use.

## Verification

```sh
npm test
npm run typecheck
npm run build:vercel
npm run test:e2e
```

`npm test` starts a disposable local MongoDB replica set and tests account/token security, roles and ownership, search, booking concurrency, availability, host approval, photo uploads, wishlists, messaging, moderation, coupons and provider-mocked payments/refunds. It never connects to Atlas or makes real payments. Browser tests use the running local app and existing ignored local test credentials. Pre-migration PostgreSQL regression tests remain under `server/tests`; they are not the default MongoDB suite.

`npm run db:check` checks the configured MongoDB connection and transaction rollback. `npm run production:check` reads `.env.production` (or `PRODUCTION_ENV_FILE`) and checks required configuration without modifying production records.

## Deployment

Keep Vercel Root Directory set to the repository root. `npm run build:vercel` produces `.vercel/output` using Vercel's Build Output API: static frontend assets plus the traced Node.js server function. Deep links and APIs route to that function; the server renders pages from the built frontend template.

Configure production `MONGODB_URI`, `SESSION_SECRET`, `SITE_URL` and `NODE_ENV=production`. Run database initialization and create your admin against that database before launch. No demonstration listings or default accounts are automatically added to Atlas. Uploads persist in MongoDB GridFS by default; optional S3-compatible storage takes priority for new uploads when configured. Configure email delivery for verification/reset links and all Razorpay keys plus the signed webhook endpoint `/api/rental/payments/webhook` for online payments. Payment keys alone do not verify settlement or refunds; test those with your provider before accepting real bookings.

The shadcn utility stylesheet is retained locally with its MIT license in `frontend/src/shadcn-utilities.css` and `frontend/src/shadcn-utilities.LICENSE`. The component-generation CLI is not required to build or run the application.

The live app is deployed by Vercel project `rishi-server` from the repository root at `https://rishi-server-three.vercel.app`. Project `rishi-frontend` uses root directory `server/operations/frontend-redirect` to redirect its older URLs to that canonical app, preserving paths and query parameters. This keeps public account and booking flows on the same backend and database. Vercel installs dependencies with the tested npm 11.6.2 version pinned in `vercel.json`.

Standalone hosting: `npm run build:vercel`, then `npm start` with the same production environment. Put HTTPS in front of the server and configure trusted proxy settings appropriately.

## Existing data

`npm run db:migrate:postgres` is an explicit, non-destructive migration tool. Set `POSTGRES_SOURCE_URL` and `MIGRATION_MONGODB_URI` privately. It preserves IDs, account password hashes and relationships, inserts missing records only, and reads the source in a read-only transaction. Remote migration additionally requires `-- --allow-atlas`; remote migration refuses a source containing demonstration listings, preventing incomplete relationships or fake production inventory. Review source data and take backups before a production migration. Source files from before this reorganization and the old local database were preserved in ignored `.data`.
