import { prisma } from "./db.js"

export async function notifyLead(lead: {
  id: string
  reference: string
  email: string
}) {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !process.env.ADMIN_NOTIFICATION_EMAIL
  )
    return "not-configured"
  try {
    const deliveries = [
      {
        to: [lead.email],
        subject: `Harshaweb enquiry ${lead.reference}`,
        text: `Thank you for contacting Harshaweb. Your enquiry has been saved with reference ${lead.reference}. Our team will review your request.\n\nHarshaweb\n${process.env.SITE_URL}`,
      },
      {
        to: [process.env.ADMIN_NOTIFICATION_EMAIL],
        subject: `New enquiry ${lead.reference}`,
        text: `A new enquiry has been saved. Sign in to ${process.env.SITE_URL}/admin to review it. Reference: ${lead.reference}.`,
      },
    ]
    const results = await Promise.allSettled(
      deliveries.map(async (message) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `${lead.id}-${message.to[0]}`,
          },
          body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }),
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok)
          throw new Error(`Email provider returned ${response.status}`)
      })
    )
    const accepted = results.filter(
      (result) => result.status === "fulfilled"
    ).length
    const emailStatus =
      accepted === deliveries.length
        ? "provider-accepted"
        : accepted === 0
          ? "failed"
          : "partial"
    if (accepted !== deliveries.length)
      console.error(
        "Some lead email notifications were not accepted by the provider."
      )
    await prisma.lead.update({ where: { id: lead.id }, data: { emailStatus } })
    return emailStatus
  } catch (error) {
    console.error(
      "Lead email notification failed",
      error instanceof Error ? error.message : "Provider error"
    )
    await prisma.lead.update({
      where: { id: lead.id },
      data: { emailStatus: "failed" },
    })
    return "failed"
  }
}
