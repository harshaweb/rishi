-- Preserve the policy agreed at reservation time when a host edits a listing later.
ALTER TABLE "RentalBooking" ADD COLUMN "bookingMode" TEXT NOT NULL DEFAULT 'HOST_APPROVAL' CHECK ("bookingMode" IN ('HOST_APPROVAL','PAYMENT')), ADD COLUMN "cancellation" TEXT NOT NULL DEFAULT 'FLEXIBLE' CHECK ("cancellation" IN ('FLEXIBLE','MODERATE','STRICT'));
UPDATE "RentalBooking" b SET "bookingMode"=p."bookingMode",cancellation=p.cancellation FROM "RentalProperty" p WHERE p.id=b."propertyId";
