export const rentalContact = {
  phone: "+91 70781 77772",
  callUrl: "tel:+917078177772",
}

export function bookingWhatsAppLink(message: string) {
  const number = rentalContact.phone.replace(/\D/g, "")
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
