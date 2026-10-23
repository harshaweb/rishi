ALTER TABLE "RentalBooking"
  ADD COLUMN "bookingType" TEXT NOT NULL DEFAULT 'OVERNIGHT'
    CHECK ("bookingType" IN ('OVERNIGHT', 'HOURLY')),
  ADD COLUMN "durationHours" INTEGER,
  ADD COLUMN "arrivalTime" TIME NOT NULL DEFAULT '15:00',
  ADD COLUMN "departureTime" TIME NOT NULL DEFAULT '11:00',
  ADD CONSTRAINT "RentalBooking_hourly_duration"
    CHECK ("durationHours" IS NULL OR "durationHours" BETWEEN 3 AND 12);
