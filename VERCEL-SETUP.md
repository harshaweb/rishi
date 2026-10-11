# Vercel repair

The failed Git commit omitted application folders. `tsconfig.app.json` correctly includes `src`; suppressing TS18003 would not restore the missing website. This repair includes the complete source/assets and a serverless Express adapter with SSR deep-link routing, explicit Prisma generation and secure HTTPS proxy cookies.

## Vercel project settings

- Root Directory: repository root (blank or `.`), not `src`.
- Framework: Vite; Node: 24.x.
- Build: `npm run build:vercel`; output: `dist`. `vercel.json` configures these settings.

## Required environment variables

| Variable | Value |
| --- | --- |
| DATABASE_URL | Managed PostgreSQL URL reachable from Vercel, using the provider's pooling guidance |
| SESSION_SECRET | New random secret, at least 32 characters |
| SITE_URL | Exact HTTPS website origin, without a trailing slash |
| NODE_ENV | production |

Do not use the local loopback database URL on Vercel. Previews with different hostnames need the matching SITE_URL and preferably a separate staging database. From a trusted environment pointing to the managed database, run `npm run db:migrate`, `npm run db:seed` and `npm run admin:create` before first use. Builds do not migrate or seed live databases automatically. Local admin credentials are not shipped.

Mail requires RESEND_API_KEY, EMAIL_FROM and ADMIN_NOTIFICATION_EMAIL. Uploads require private S3-compatible storage, using variables in `.env.example`. Serverless disk is not persistent. Files are limited to 4 MB to leave room below Vercel's 4.5 MB request limit. Enquiries save independently of email delivery.

## Credentials

The original public repository tracked `.env` and `.env.test` despite its ignore rules. This repair removes them from the new tree. Rotate any real credentials they contained: deletion does not erase old Git commits. Commit only `.env.example` placeholders.

## Verification

Fresh-checkout check: `npm ci --ignore-scripts`, then `npm run build:vercel`. Explicit generation handles skipped npm install scripts. Tests exercise the function handler, real database API, protected routes, SSR, 404s, sitemap and secure session cookies. Local build verification does not prove a successful cloud deployment.

After merging the repair and configuring cloud credentials, redeploy and check `/`, `/services`, `/admin`, `/api/health`, an enquiry and external mail/storage integrations.

References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [limits](https://vercel.com/docs/functions/limitations).
