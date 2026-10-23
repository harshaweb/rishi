/** The marketplace's supported Delhi NCR cities, shared by forms and APIs. */
export const rentalCities = [
  "Delhi",
  "Gurugram",
  "Noida",
  "Greater Noida",
  "Ghaziabad",
  "Faridabad",
] as const
export function rentalCity(value: string): string | undefined {
  const input = value.trim().toLowerCase().replace(/\s+/g, " ")
  if (["new delhi", "delhi"].includes(input)) return "Delhi"
  if (["gurgaon", "gurugram"].includes(input)) return "Gurugram"
  return rentalCities.find((city) => city.toLowerCase() === input)
}
export function rentalDestination(value: string): string {
  if (
    ["ncr", "delhi ncr", "delhi-ncr", "delhi & ncr", "delhi and ncr"].includes(
      value.trim().toLowerCase()
    )
  )
    return ""
  return rentalCity(value) || value.trim()
}
