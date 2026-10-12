> Historical pre-MongoDB documentation. For the current two-folder layout, MongoDB setup and deployment commands, use ../../README.md and MONGODB-SETUP.md.

# Omshivraj production release

The production application serves the built React frontend and authenticated Express APIs together. PostgreSQL stores accounts, stays, inventory, reservations and administration data. A static `dist` upload alone cannot run the marketplace.

## Configure the release environment

Supply server environment variables through your hosting provider, or an ignored `.env.production` for local release checks. Never put server credentials in `VITE_` variables. `npm run production:check` reads `.env.production` or existing process variables, never the development `.env`. Set `PRODUCTION_ENV_FILE` to use a different file.

- `NODE_ENV=production`, a managed PostgreSQL `DATABASE_URL`, a random `SESSION_SECRET` of at least 32 characters, and `SITE_URL` set to your actual HTTPS origin.
- Leave `MONGODB_URL` unset and `LOCAL_POSTGRES=0`. The rental system requires PostgreSQL transactions.
- Configure `RESEND_API_KEY` and a verified `EMAIL_FROM` for account verification, password recovery and booking notifications.
- Configure `S3_BUCKET`, `S3_REGION` and runtime storage access through workload credentials or AWS credentials. An optional `S3_ENDPOINT` supports compatible providers.
- For online-payment stays, configure all three `RAZORPAY_*` settings from `.env.example`. Verify test checkout, webhook retries and refunds before using live keys. Host-approval stays use payment at the property.
- Set `TRUST_PROXY=1` only behind a trusted reverse proxy with direct access blocked. Containers require `HOST=0.0.0.0` and the platform's `PORT`.

## Build and launch

1. Run `npm ci`, `npm run db:generate` and `npm run build`.
2. In a release process with production environment variables, run `npm run db:migrate`. Back up an existing database first. Builds do not automatically migrate production data.
3. Provision a unique administrator with temporary `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` variables and `npm run rental:admin`. Remove bootstrap variables afterwards. Do not reuse demo accounts or run `rental:seed` in production.
4. Run `npm run rental:catalog`, approve real hosts and publish verified property listings. Configure actual support and legal information in the dashboard. Do not publish demonstration inventory as real accommodation.
5. Run `npm run production:check` against the target environment. This reports missing settings and checks database access without printing secrets or changing data. Verify provider access separately.
6. Run `npm start` with production variables injected. This serves the frontend and backend on the same origin. For Vercel, use the root `vercel.json`, which builds `dist` and the API function; configure the same variables in Vercel and migrate separately.
7. Schedule `npm run rental:expire` every five minutes. Verify database backups and restore procedures, storage permissions, email delivery, actual booking/cancellation flows and HTTPS access on the deployed origin.

## Release verification

`npm test` checks the isolated test database. `npm run test:production` starts a separate production server against that isolated database and checks rendering, hydration, routes, mobile images and security headers. It does not charge customers or test external provider delivery. Never point mutation/browser tests at customer data.

Prepared builds are local artifacts until deployed with real infrastructure credentials. The current local development database and demo inventory are not a public production deployment.
