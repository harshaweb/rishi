> Historical pre-MongoDB documentation. For the current two-folder layout, MongoDB setup and deployment commands, use ../../README.md and MONGODB-SETUP.md.

# Omshivraj application connection

The existing React/Vite frontend calls the Express backend through `/api`. The backend stores accounts, listings, photos, reservations, messages, settings and audit records in PostgreSQL. The local environment is already configured in the ignored `.env` file.

## Run locally

From the repository folder, run `npm run dev`. This starts the local database, applies migrations, and starts both application servers.

- Website: http://localhost:5173/
- Admin: http://localhost:5173/admin
- Backend health: http://localhost:3001/api/health

Run `npm run verify:connection` while the application is running. It checks a database write/read transaction, rolls it back, verifies frontend API routing and checks that anonymous users cannot read admin data. It does not retain test records or print credentials.

For a new local checkout, run `npm ci` and `npm run setup:local` first. See `RENTAL-SETUP.md` for account provisioning and rental setup. Local administrator access is stored in the ignored `.data/local-admin.txt` file.

## Production connection

Configure a managed PostgreSQL `DATABASE_URL`, a strong `SESSION_SECRET`, and the deployed HTTPS `SITE_URL` in your hosting environment. Set `NODE_ENV=production`. Leave `MONGODB_URL` unset: the rental marketplace requires PostgreSQL transactions and inventory constraints. Apply migrations using `npm run db:migrate` and provision an administrator using `npm run rental:admin` with temporary bootstrap environment variables.

Local connection checks do not configure or verify a production deployment. Payments, transactional email and production uploads require the separate provider settings documented in `RENTAL-SETUP.md`. Database passwords and other server credentials must never use a `VITE_` prefix or be committed to Git.
