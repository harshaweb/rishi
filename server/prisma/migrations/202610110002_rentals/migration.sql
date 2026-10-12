CREATE TABLE "RentalUser" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL,
 "role" TEXT NOT NULL DEFAULT 'GUEST' CHECK ("role" IN ('GUEST','HOST','ADMIN')), "verified" BOOLEAN NOT NULL DEFAULT false,
 "active" BOOLEAN NOT NULL DEFAULT true, "sessionVersion" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "RentalProfile" ("userId" TEXT PRIMARY KEY REFERENCES "RentalUser"("id") ON DELETE CASCADE, "phone" TEXT NOT NULL DEFAULT '', "photo" TEXT NOT NULL DEFAULT '', "notifications" BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE "RentalHost" ("userId" TEXT PRIMARY KEY REFERENCES "RentalUser"("id") ON DELETE CASCADE, "bio" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED')), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalToken" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE CASCADE, "hash" TEXT NOT NULL UNIQUE, "kind" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "usedAt" TIMESTAMPTZ);
CREATE TABLE "RentalCategory" ("name" TEXT PRIMARY KEY, "active" BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE "RentalAmenity" ("name" TEXT PRIMARY KEY);
CREATE TABLE "RentalProperty" (
 "id" TEXT PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "hostId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE RESTRICT,
 "title" TEXT NOT NULL, "city" TEXT NOT NULL, "address" TEXT NOT NULL, "category" TEXT NOT NULL REFERENCES "RentalCategory"("name"), "type" TEXT NOT NULL,
 "description" TEXT NOT NULL, "nightlyRate" INTEGER NOT NULL CHECK ("nightlyRate">0), "cleaningFee" INTEGER NOT NULL DEFAULT 0 CHECK ("cleaningFee">=0),
 "capacity" INTEGER NOT NULL CHECK ("capacity">0), "bedrooms" INTEGER NOT NULL CHECK ("bedrooms">=0), "beds" INTEGER NOT NULL CHECK ("beds">0), "bathrooms" INTEGER NOT NULL CHECK ("bathrooms">0),
 "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("latitude" BETWEEN -90 AND 90), "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("longitude" BETWEEN -180 AND 180),
 "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','PENDING','PUBLISHED','REJECTED')), "approvedAt" TIMESTAMPTZ,
 "cancellation" TEXT NOT NULL DEFAULT 'FLEXIBLE' CHECK ("cancellation" IN ('FLEXIBLE','MODERATE','STRICT')), "instantBook" BOOLEAN NOT NULL DEFAULT false,
 "bookingMode" TEXT NOT NULL DEFAULT 'HOST_APPROVAL' CHECK ("bookingMode" IN ('HOST_APPROVAL','PAYMENT')), "demo" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "RentalProperty_search" ON "RentalProperty"("status", "city", "nightlyRate", "capacity");
CREATE INDEX "RentalProperty_host" ON "RentalProperty"("hostId");
CREATE TABLE "RentalPropertyImage" ("id" TEXT PRIMARY KEY, "propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE CASCADE, "url" TEXT NOT NULL, "alt" TEXT NOT NULL DEFAULT '', "position" INTEGER NOT NULL DEFAULT 0);
CREATE INDEX "RentalPropertyImage_order" ON "RentalPropertyImage"("propertyId","position");
CREATE TABLE "RentalPropertyAmenity" ("propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE CASCADE, "amenity" TEXT NOT NULL REFERENCES "RentalAmenity"("name"), PRIMARY KEY ("propertyId","amenity"));
CREATE TABLE "RentalBlockedDate" ("id" TEXT PRIMARY KEY, "propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE CASCADE, "start" DATE NOT NULL, "end" DATE NOT NULL, "reason" TEXT NOT NULL DEFAULT '', CHECK ("end">"start"));
CREATE TABLE "RentalBooking" (
 "id" TEXT PRIMARY KEY, "reference" TEXT NOT NULL UNIQUE, "propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE RESTRICT,
 "guestId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE RESTRICT, "checkIn" DATE NOT NULL, "checkOut" DATE NOT NULL, "guests" INTEGER NOT NULL CHECK ("guests">0),
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','CONFIRMED','CANCELLED','PAYMENT_FAILED','COMPLETED')),
 "nightlySubtotal" INTEGER NOT NULL CHECK ("nightlySubtotal">=0), "cleaningFee" INTEGER NOT NULL CHECK ("cleaningFee">=0), "platformFee" INTEGER NOT NULL CHECK ("platformFee">=0), "tax" INTEGER NOT NULL CHECK ("tax">=0), "discount" INTEGER NOT NULL DEFAULT 0 CHECK ("discount">=0), "total" INTEGER NOT NULL CHECK ("total">=0),
 "expiresAt" TIMESTAMPTZ, "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID', "idempotencyKey" TEXT NOT NULL UNIQUE, "cancelReason" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK ("checkOut">"checkIn")
);
CREATE INDEX "RentalBooking_guest" ON "RentalBooking"("guestId","createdAt");
CREATE INDEX "RentalBooking_availability" ON "RentalBooking"("propertyId","checkIn","checkOut","status");
-- Every occupied night has a unique inventory row. Adjacent stays do not conflict.
CREATE TABLE "RentalBookingNight" ("propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE RESTRICT, "night" DATE NOT NULL, "bookingId" TEXT NOT NULL REFERENCES "RentalBooking"("id") ON DELETE CASCADE, PRIMARY KEY ("propertyId","night"));
CREATE INDEX "RentalBookingNight_booking" ON "RentalBookingNight"("bookingId");
CREATE TABLE "RentalPayment" ("id" TEXT PRIMARY KEY, "bookingId" TEXT NOT NULL UNIQUE REFERENCES "RentalBooking"("id") ON DELETE RESTRICT, "orderId" TEXT UNIQUE, "paymentId" TEXT UNIQUE, "amount" INTEGER NOT NULL CHECK ("amount">=0), "currency" TEXT NOT NULL DEFAULT 'INR', "status" TEXT NOT NULL DEFAULT 'CREATED', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalRefund" ("id" TEXT PRIMARY KEY, "bookingId" TEXT NOT NULL UNIQUE REFERENCES "RentalBooking"("id") ON DELETE RESTRICT, "paymentId" TEXT NOT NULL, "providerId" TEXT UNIQUE, "amount" INTEGER NOT NULL CHECK ("amount">=0), "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalPaymentEvent" ("id" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalWishlist" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalWishlistItem" ("wishlistId" TEXT NOT NULL REFERENCES "RentalWishlist"("id") ON DELETE CASCADE, "propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE CASCADE, PRIMARY KEY ("wishlistId","propertyId"));
CREATE TABLE "RentalReview" ("id" TEXT PRIMARY KEY, "bookingId" TEXT NOT NULL UNIQUE REFERENCES "RentalBooking"("id") ON DELETE RESTRICT, "propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE RESTRICT, "userId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE RESTRICT, "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5), "body" TEXT NOT NULL, "response" TEXT NOT NULL DEFAULT '', "visible" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalConversation" ("id" TEXT PRIMARY KEY, "propertyId" TEXT NOT NULL REFERENCES "RentalProperty"("id") ON DELETE RESTRICT, "guestId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE RESTRICT, "hostId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE RESTRICT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE ("propertyId","guestId"));
CREATE TABLE "RentalMessage" ("id" TEXT PRIMARY KEY, "conversationId" TEXT NOT NULL REFERENCES "RentalConversation"("id") ON DELETE CASCADE, "senderId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE RESTRICT, "body" TEXT NOT NULL, "readAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX "RentalMessage_thread" ON "RentalMessage"("conversationId","createdAt");
CREATE TABLE "RentalNotification" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE CASCADE, "body" TEXT NOT NULL, "link" TEXT NOT NULL, "readAt" TIMESTAMPTZ, "emailStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalReport" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "RentalUser"("id") ON DELETE RESTRICT, "targetId" TEXT NOT NULL, "body" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "RentalCoupon" ("code" TEXT PRIMARY KEY, "percent" INTEGER NOT NULL CHECK ("percent" BETWEEN 1 AND 50), "expiresAt" TIMESTAMPTZ NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE "RentalSetting" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL);
CREATE TABLE "RentalAudit" ("id" TEXT PRIMARY KEY, "userId" TEXT REFERENCES "RentalUser"("id") ON DELETE SET NULL, "action" TEXT NOT NULL, "entityId" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
