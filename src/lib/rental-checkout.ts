import { rentalRequest } from "../rental-state"
import type { RentalBooking } from "../../shared/rentals"

type CheckoutOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  theme: { color: string }
  handler: (data: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal: { ondismiss: () => void }
}
declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => {
      open: () => void
      on: (event: string, callback: () => void) => void
    }
  }
}

let scriptLoading: Promise<void> | undefined
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  return (scriptLoading ||= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    const timer = window.setTimeout(() => fail(), 15000)
    const fail = () => {
      window.clearTimeout(timer)
      script.remove()
      reject(
        new Error(
          "Unable to load secure checkout. Please try again from Trips."
        )
      )
    }
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => {
      if (!window.Razorpay) return fail()
      window.clearTimeout(timer)
      resolve()
    }
    script.onerror = fail
    document.head.appendChild(script)
  }).finally(() => {
    scriptLoading = undefined
  }))
}

// The provider UI collects payment details; only the server can confirm a booking.
export async function rentalCheckout(
  booking: RentalBooking,
  refresh: () => void,
  notify: (message: string) => void
) {
  try {
    await loadCheckout()
    const order = await rentalRequest<{
      orderId: string
      amount: number
      currency: string
      key: string
    }>(`/bookings/${booking.id}/pay`)
    await new Promise<void>((resolve, reject) => {
      let verifying = false
      const widget = new window.Razorpay!({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Omshivraj",
        description: `Reservation ${booking.reference}`,
        theme: { color: "#e31c5f" },
        handler: async (data) => {
          verifying = true
          notify("Checking your payment with the provider…")
          try {
            const result = await rentalRequest<RentalBooking>(
              `/bookings/${booking.id}/verify`,
              {
                paymentId: data.razorpay_payment_id,
                orderId: data.razorpay_order_id,
                signature: data.razorpay_signature,
              }
            )
            notify(
              result.status === "CONFIRMED"
                ? "Payment verified. Your reservation is confirmed."
                : "Your hold expired before payment completed. A full refund is pending; check Trips."
            )
          } catch (error) {
            notify(
              `${(error as Error).message} Check Trips before attempting another payment.`
            )
          } finally {
            refresh()
            resolve()
          }
        },
        modal: {
          ondismiss: () => {
            if (verifying) return
            notify(
              "Checkout closed. You can retry from Trips before your hold expires."
            )
            refresh()
            resolve()
          },
        },
      })
      widget.on("payment.failed", () => {
        notify(
          "This payment attempt failed. Retry in checkout or return to Trips. Your hold remains until expiry."
        )
      })
      try {
        widget.open()
      } catch (error) {
        reject(error)
      }
    })
  } catch (error) {
    notify((error as Error).message)
  }
}
