# Omshivraj Razorpay setup

Online-payment stays use Razorpay Standard Checkout. The guest selects dates, reviews the server-calculated price, and continues to payment. Checkout opens directly after the temporary reservation is created; Trips also offers a Pay button until the hold expires. Host-approval stays continue to use payment at the property.

## Configure credentials

Start with Razorpay test mode. Supply these server-only variables in the ignored local `.env`, or in Vercel project rishi → Settings → Environment Variables for Production:

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Never prefix secrets with VITE_, commit them, or share them in chat. Restart the local backend after changing variables; redeploy Vercel after changing its environment variables. A working managed PostgreSQL DATABASE_URL is also required on Vercel.

## Configure the Razorpay dashboard

Create a webhook pointing to `https://rishi-rust.vercel.app/api/rental/payments/webhook`, using the same secret as RAZORPAY_WEBHOOK_SECRET. Subscribe to `payment.captured` and `refund.processed`. Configure automatic capture. For local webhook tests, use a secure public tunnel to the local backend and set its webhook URL separately.

Set the property's booking mode to **Verified online payment** in the host listing editor. Only publish accurate, verified accommodation. Do not charge for demonstration listings.

## Verify before accepting real payments

Use test credentials and test payments first. Check success, rejection/retry, closing checkout, booking expiry, webhook delivery/retries, and refunds. Confirm that a paid booking appears in Trips and the admin Payments section. A browser success callback alone does not confirm a booking: the backend verifies its signature and fetches the captured payment, matching order, amount and currency. Failed attempts preserve the hold for retry; late captured payments create a full refund request instead of confirming expired inventory. Refund requests still require processing from the admin dashboard.

When account activation and testing are complete, replace test keys with live keys, configure the live webhook separately, and redeploy. Real provider processing cannot be verified without your account credentials.

Official reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
