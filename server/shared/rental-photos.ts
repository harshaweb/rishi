/** Uploaded photographs used to illustrate the demonstration catalogue. */
export function demoStayPhotos(slug: string): string[] {
  const offset =
    slug === "delhi-apartment-2"
      ? 0
      : [...slug].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 25
  return Array.from(
    { length: 5 },
    (_, index) =>
      `/gallery/photo-${String(((offset + index) % 25) + 1).padStart(2, "0")}.jpg`
  )
}
