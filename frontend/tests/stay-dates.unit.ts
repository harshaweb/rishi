import { test } from "node:test"
import assert from "node:assert/strict"
import { availableStay, unavailableNight } from "../src/lib/stay-dates"

const blocked = [{ start: "2026-11-10", end: "2026-11-13" }]
test("blocked nights exclude checkout, allowing back-to-back stays", () => {
  assert.equal(unavailableNight("2026-11-10", blocked), true)
  assert.equal(unavailableNight("2026-11-13", blocked), false)
  assert.equal(availableStay("2026-11-08", "2026-11-10", blocked), true)
  assert.equal(availableStay("2026-11-13", "2026-11-15", blocked), true)
})
test("a range cannot cross or start inside unavailable nights", () => {
  assert.equal(availableStay("2026-11-08", "2026-11-15", blocked), false)
  assert.equal(availableStay("2026-11-11", "2026-11-15", blocked), false)
})
test("checkout must be later and stay length is capped at 90 nights", () => {
  assert.equal(availableStay("2026-11-08", "2026-11-08", []), false)
  assert.equal(availableStay("2026-11-09", "2026-11-08", []), false)
  assert.equal(availableStay("2026-11-01", "2027-01-30", []), true)
  assert.equal(availableStay("2026-11-01", "2027-01-31", []), false)
  assert.equal(availableStay("", "2026-11-08", []), false)
})

