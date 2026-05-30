CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key"
  ON "PushSubscription"("endpoint");

CREATE UNIQUE INDEX "PushSubscription_id_shopId_key"
  ON "PushSubscription"("id", "shopId");

CREATE INDEX "PushSubscription_shopId_userId_isActive_idx"
  ON "PushSubscription"("shopId", "userId", "isActive");

CREATE INDEX "PushSubscription_shopId_isActive_updatedAt_idx"
  ON "PushSubscription"("shopId", "isActive", "updatedAt");

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
