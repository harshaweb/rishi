import { rentalRequest } from "../rental-state"
import type { RentalBooking } from "../../../server/shared/rentals"

type CheckoutOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  theme: { color: string }
  config: {
    display: {
      blocks: Record<string, { name: string; instruments: { method: string }[] }>
      sequence: string[]
      preferences: { show_default_blocks: boolean }
    }
  }
  handler: (data: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal: { ondismiss: () => void }
}
export type RentalPaymentMethod = "upi" | "card" | "netbanking"
type DemoOutcome = "success" | "failure" | "cancel"

function chooseDemoOutcome(amount: number, method: RentalPaymentMethod) {
  return new Promise<DemoOutcome>((resolve) => {
    const dialog = document.createElement("dialog")
    dialog.className = "rental-demo-checkout"
    dialog.innerHTML = `
      <form method="dialog" class="rental-demo-checkout__panel">
        <p class="rental-demo-checkout__eyebrow">DEMO PAYMENT GATEWAY</p>
        <h2>Test your checkout</h2>
        <p class="rental-demo-checkout__amount">₹${(amount / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
        <p class="rental-demo-checkout__copy">${method === "upi" ? "PhonePe / UPI" : method === "card" ? "Debit or credit card" : "Net banking"} · No real payment will be made.</p>
        <div class="rental-demo-checkout__actions">
          <button value="success" class="rental-demo-checkout__success">Simulate success</button>
          <button value="failure" class="rental-demo-checkout__failure">Simulate failure</button>
          <button value="cancel" class="rental-demo-checkout__cancel">Cancel</button>
        </div>
      </form>`
    const style = document.createElement("style")
    style.textContent = `
      .rental-demo-checkout { width:min(440px,calc(100% - 32px)); padding:0; border:0; border-radius:20px; color:#202124; box-shadow:0 24px 80px #0005; }
      .rental-demo-checkout::backdrop { background:#17203399; backdrop-filter:blur(3px); }
      .rental-demo-checkout__panel { padding:28px; font:inherit; }
      .rental-demo-checkout__eyebrow { margin:0 0 8px; color:#e31c5f; font-size:11px; font-weight:800; letter-spacing:.12em; }
      .rental-demo-checkout h2 { margin:0; font-size:24px; }
      .rental-demo-checkout__amount { margin:20px 0 4px; font-size:32px; font-weight:800; }
      .rental-demo-checkout__copy { margin:0 0 24px; color:#666; font-size:14px; }
      .rental-demo-checkout__actions { display:grid; gap:10px; }
      .rental-demo-checkout__actions button { min-height:44px; border:0; border-radius:10px; font:inherit; font-weight:700; cursor:pointer; }
      .rental-demo-checkout__success { color:white; background:#14804a; }
      .rental-demo-checkout__failure { color:#8b2635; background:#fff0f1; }
      .rental-demo-checkout__cancel { color:#333; background:#f2f3f5; }`
    document.head.appendChild(style)
    document.body.appendChild(dialog)
    let settled = false
    const finish = (outcome: DemoOutcome) => {
      if (settled) return
      settled = true
      dialog.close()
      dialog.remove()
      style.remove()
      resolve(outcome)
    }
    dialog.addEventListener("close", () => finish("cancel"), { once: true })
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) finish("cancel")
    })
    dialog.addEventListener("submit", (event) => {
      event.preventDefault()
      const value = (event.submitter as HTMLButtonElement | null)?.value
      finish(value === "success" || value === "failure" ? value : "cancel")
    })
    dialog.showModal()
  })
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
  notify: (message: string) => void,
  method: RentalPaymentMethod = "upi"
) {
  try {
    const order = await rentalRequest<{
      mode?: "DEMO" | "RAZORPAY"
      orderId: string
      amount: number
      currency: string
      key?: string
    }>(`/bookings/${booking.id}/pay`, { method })
    if (order.mode === "DEMO") {
      const outcome = await chooseDemoOutcome(order.amount, method)
      if (outcome === "cancel") {
        notify(
          "Demo checkout closed. No payment was made; your reservation hold remains active."
        )
        refresh()
        return
      }
      const result = await rentalRequest<{
        outcome: "success" | "failure"
        message?: string
      }>(`/bookings/${booking.id}/demo-complete`, {
        orderId: order.orderId,
        outcome,
      })
      notify(
        result.outcome === "success"
          ? "Demo payment succeeded. Your reservation is confirmed; no money was charged."
          : result.message || "Demo payment failed. No money was charged."
      )
      refresh()
      return
    }
    await loadCheckout()
    await new Promise<void>((resolve, reject) => {
      let verifying = false
      const widget = new window.Razorpay!({
        key: order.key || "",
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Omshivraj",
        description: `Reservation ${booking.reference}`,
        theme: { color: "#e31c5f" },
        config: {
          display: {
            blocks: {
              selected: {
                name:
                  method === "upi"
                    ? "PhonePe / UPI apps"
                    : method === "card"
                      ? "Debit or credit card"
                      : "Net banking",
                instruments: [{ method }],
              },
            },
            sequence: ["block.selected"],
            preferences: { show_default_blocks: false },
          },
        },
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
