/** Owner-supplied photos from the 14 October 2026 uploads. */
export const newOwnerPhotos = [
  "Kitchenette with dark cabinets, a refrigerator and ceiling lighting",
  "Bedroom with patterned bedding, wall-mounted air conditioning and dark curtains",
  "Lounge with a corner sofa, round table and patterned rug",
  "Double bedroom with a padded headboard and recessed ceiling lighting",
  "Bedroom with patterned bedding, dark curtains and a wall-mounted television",
  "Double bed with a padded feature wall and bedside lamps",
  "Bedroom with patterned bedding, air conditioning and tiled flooring",
  "Kitchenette with a kettle, cabinets, refrigerator and decorative plants",
  "Entryway with a mirror, decorative plants and a kitchen counter",
  "Bathroom with a basin, toilet, wall-mounted mirror and water heater",
  "Bedroom corner with a television, dark curtains and ceiling fan",
].map((alt, index) => ({
  src: `/gallery/oct14-${String(index + 1).padStart(2, "0")}.jpg`,
  alt,
}))
