# DigiLocker booking verification

Implementation follows the official Requester API v1.12:
https://apisetu.gov.in/digilocker

This integration confirms control of an Aadhaar-linked DigiLocker account using the account details API. It does not authenticate, fetch, or retain identity documents.

## Configure

Use approved **DigiLocker Requester** credentials with access to the **Get User Details** API. Meri Pehchaan or third-party provider credentials use different contracts and must not be substituted.

Register the exact callback:

`https://rishi-server-three.vercel.app/api/rental/digilocker/callback`

Set these private backend environment variables in Vercel project **rishi-server**, for Production:

- `DIGILOCKER_CLIENT_ID`
- `DIGILOCKER_CLIENT_SECRET`
- `SITE_URL=https://rishi-server-three.vercel.app`
- `DIGILOCKER_REQUIRED=1`

Save the same credentials in the ignored root `.env` for local testing, with `SITE_URL=http://localhost:5173` and a separately approved callback `http://localhost:5173/api/rental/digilocker/callback`. Never commit secrets. Restart the local API after editing `.env`; redeploy Vercel after changing production variables.

Until credentials and callback approval are ready, leave `DIGILOCKER_REQUIRED=0` and keep the existing booking flow available. With `1`, unverified guests cannot book even if the provider is unavailable. Existing bookings remain accessible. Email verification is still required independently.

## Verify before enabling production

Sign in as a guest, select a flat, accept the account-details disclosure and continue to DigiLocker. Complete the real consent flow personally. Confirm return to the same flat with verification status and restored dates. Re-check availability and request the booking explicitly; no booking is created by the callback.

Also check rejected consent, an expired flow, an unlinked account, and a session with verification incomplete. The booking API must reject attempts that bypass the UI.

## Security and retained data

Authorization uses S256 PKCE, a cryptographically random state, a ten-minute one-time MongoDB attempt, and a dedicated HttpOnly SameSite=Lax browser-binding cookie. The main session cookie remains Strict. Callback processing does not depend on a server instance's memory. Return paths are restricted to local stay pages. Account disablement/session-version changes invalidate in-flight attempts.

Only user ID, provider, consent/verification timestamps and a keyed digest of the provider account ID are retained in `RentalIdentityVerification`. Profile details and tokens are not stored or logged. Access/refresh token revocation is attempted after each successful token exchange. Pending attempt records expire automatically. Support must include verification records when processing account data deletion requests.

Credentials must never be sent in a browser bundle. Tests use mocked provider responses and a disposable local MongoDB replica set; a real consenting guest must complete the final provider test.
