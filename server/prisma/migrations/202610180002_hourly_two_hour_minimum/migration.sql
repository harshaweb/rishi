ALTER TABLE "RentalBooking"
  DROP CONSTRAINT IF EXISTS "RentalBooking_hourly_duration";

ALTER TABLE "RentalBooking"
  ADD CONSTRAINT "RentalBooking_hourly_duration"
    CHECK ("durationHours" IS NULL OR "durationHours" BETWEEN 2 AND 12);
