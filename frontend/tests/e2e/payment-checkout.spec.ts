import { test, expect } from "@playwright/test"

test("secure checkout preserves a failed attempt and confirms only after verification", async ({
  page,
}) => {
  let paid = false
  let failedRequests = 0
  let verified = false
  const booking = {
    id: "checkout-browser-test",
    reference: "HV-PAYTEST",
    title: "Delhi apartment",
    slug: "delhi-apartment-2",
    city: "Delhi",
    image: "/gallery/photo-01.jpg",
    checkIn: "2027-05-01",
    checkOut: "2027-05-03",
    guests: 2,
    total: 450000,
    bookingMode: "PAYMENT",
    expiresAt: "2027-04-30T12:00:00Z",
    status: "PENDING",
    paymentStatus: "UNPAID",
  }
  await page.route("**/api/rental/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "guest-browser-test",
          name: "Guest",
          email: "guest@test.invalid",
          role: "GUEST",
          verified: true,
        },
        csrf: "browser-test",
        paymentsConfigured: true,
      },
    })
  )
  await page.route("**/api/rental/bookings", (route) =>
    route.fulfill({
      json: [
        {
          ...booking,
          ...(paid
            ? { status: "CONFIRMED", paymentStatus: "PAID", expiresAt: null }
            : {}),
        },
      ],
    })
  )
  await page.route(
    "**/api/rental/bookings/checkout-browser-test/pay",
    (route) =>
      route.fulfill({
        json: {
          orderId: "order_browser_test",
          key: "rzp_test_browser",
          amount: booking.total,
          currency: "INR",
        },
      })
  )
  await page.route(
    "**/api/rental/bookings/checkout-browser-test/payment-failed",
    (route) => {
      failedRequests++
      return route.fulfill({ json: { ok: true } })
    }
  )
  await page.route(
    "**/api/rental/bookings/checkout-browser-test/verify",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        orderId: "order_browser_test",
        paymentId: "pay_browser_test",
        signature: "provider-signature",
      })
      verified = true
      paid = true
      await route.fulfill({
        json: { ...booking, status: "CONFIRMED", paymentStatus: "PAID" },
      })
    }
  )
  // No real gateway requests or charges: exercise the UI with provider callbacks.
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
      window.Razorpay = function(options) {
        window.checkoutOptions = options;
        this.on = function(event, callback) { window.failedAttempt = callback; };
        this.open = function() { window.checkoutOpened = true; };
      };
    `,
    })
  )
  await page.goto("/trips")
  const pay = page.getByRole("button", { name: /Pay .* securely/ })
  await pay.click()
  await expect.poll(() => page.evaluate("window.checkoutOpened")).toBe(true)
  await expect(
    page.getByRole("button", { name: "Opening secure checkout…" })
  ).toBeDisabled()
  await page.evaluate("window.failedAttempt()")
  expect(failedRequests).toBe(0)
  expect(verified).toBe(false)
  await page.evaluate("window.checkoutOptions.modal.ondismiss()")
  await expect(pay).toBeEnabled()
  await pay.click()
  await expect(
    page.getByRole("button", { name: "Opening secure checkout…" })
  ).toBeDisabled()
  await page.evaluate(`window.checkoutOptions.handler({
    razorpay_order_id: "order_browser_test", razorpay_payment_id: "pay_browser_test",
    razorpay_signature: "provider-signature"
  })`)
  await expect(page.locator(".r-trip .r-badge")).toHaveText("CONFIRMED")
  expect(verified).toBe(true)
  expect(failedRequests).toBe(0)
  await expect(
    page.getByRole("button", { name: /Pay .* securely/ })
  ).toHaveCount(0)
})
