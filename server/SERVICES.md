# Omshivraj live service setup

App: https://rishi-server-three.vercel.app  
Vercel project: **rishi-server**, repository root directory.

The integrations are implemented. Provider credentials and successful real-provider tests are still required. A configured flag only checks that environment values exist; it does not prove delivery, approval, settlement or verification.

## 1. Email verification and password resets — Resend

1. Sign in at https://resend.com/domains and add a domain you own, or a sending subdomain such as `mail.your-domain.com`. Gmail and `vercel.app` are not domains you can verify for this purpose.
2. At your domain's DNS provider, add the exact records shown by Resend. Preserve existing records; do not invent SPF/DKIM values or replace mail records indiscriminately. Wait until Resend marks the sending domain verified.
3. In Resend API Keys, create a sending-access key restricted to the verified domain where available. Save it privately.
4. Add these backend variables in Vercel project Settings → Environment Variables → Production:

   | Variable | Value |
   | --- | --- |
   | `RESEND_API_KEY` | Private sending key |
   | `EMAIL_FROM` | `Omshivraj <bookings@mail.your-domain.com>` using your verified sending domain |
   | `SITE_URL` | `https://rishi-server-three.vercel.app` |

5. Redeploy. With your own guest account, request a verification email, open it and verify that booking becomes available. Test password reset with your own inbox too. Provider acceptance alone is not inbox delivery.

Do not use a test-only sender as the public guest-email setup.

Official instructions: [domains](https://resend.com/docs/dashboard/domains/introduction), [API keys](https://resend.com/docs/dashboard/api-keys/introduction).

## 2. Online payments — Razorpay

1. Sign in at https://dashboard.razorpay.com and select **Test Mode** for initial integration tests. Use a separate staging deployment/database for test payments so test confirmations cannot reserve production flats.
2. Account & Settings → Website and app settings → API Keys. Save the selected mode's key ID and secret privately.
3. Under Webhooks, configure your staging endpoint for testing; for production use exactly:

   `https://rishi-server-three.vercel.app/api/rental/payments/webhook`

4. Choose a private webhook secret and enable **payment.captured** and **refund.processed**. These are the events handled by this application. The webhook secret is separate from the API key secret.
5. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in the matching deployment environment, then redeploy.
6. In staging, test checkout, cancellation, duplicate webhook delivery and refunds. Confirm both app booking status and provider records.
7. Complete Razorpay merchant activation/website approval yourself. Once approved, configure **Live Mode** credentials and a live webhook in Production. Do not leave test keys on a public payment booking flow.

Current flats use `HOST_APPROVAL` with payment at the property. Keep that mode until online payments are approved and tested; credentials do not automatically change property booking modes. Enable online payment only for listings the owner chooses.

Official instructions: [API keys](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/), [webhooks](https://razorpay.com/docs/payments/dashboard/account-settings/webhooks/).

## 3. Required identity verification — DigiLocker

Use approved **DigiLocker Requester API v1.12** credentials with Get User Details permission. MeriPehchaan and third-party credentials are different integrations.

Register this exact callback with the provider:

`https://rishi-server-three.vercel.app/api/rental/digilocker/callback`

Save `DIGILOCKER_CLIENT_ID` and `DIGILOCKER_CLIENT_SECRET` privately in Vercel Production. Keep `DIGILOCKER_REQUIRED=0` until credentials, callback approval and the real consent flow have been tested. Then set `DIGILOCKER_REQUIRED=1` and redeploy to enforce verification before bookings.

A consenting user must complete the real DigiLocker flow personally. Confirm return to the same flat, preserved booking dates and verified status; also check declined consent. The callback does not create a booking. This integration verifies control of an Aadhaar-linked DigiLocker account, not the authenticity of downloaded identity documents.

Detailed implementation and test steps: [DIGILOCKER.md](DIGILOCKER.md). Official resource: https://apisetu.gov.in/digilocker.

## Save and check

Local credentials belong in the ignored root `.env`. Local values do not automatically update Vercel. Never add provider secrets to frontend `VITE_*` variables, Git, screenshots or chat. Keep Production and Preview credentials separate.

After changing production values, redeploy and inspect Admin → Overview → Guest services. Run `npm run production:check` with a private `.env.production` for the broader readiness audit. It is read-only and may also report incomplete property addresses or database access problems.

Automated tests (`npm run test:mongo`) use disposable MongoDB and mocked provider responses. They do not replace real email delivery, Razorpay merchant approval/payment tests or the consenting DigiLocker account test.
