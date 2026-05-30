CREATE TABLE "AppNotification" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "recipientUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "eyebrow" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppNotification_shopId_recipientUserId_eventKey_key"
  ON "AppNotification"("shopId", "recipientUserId", "eventKey");

CREATE INDEX "AppNotification_shopId_recipientUserId_readAt_createdAt_idx"
  ON "AppNotification"("shopId", "recipientUserId", "readAt", "createdAt");

CREATE INDEX "AppNotification_shopId_type_createdAt_idx"
  ON "AppNotification"("shopId", "type", "createdAt");

ALTER TABLE "AppNotification"
  ADD CONSTRAINT "AppNotification_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotification"
  ADD CONSTRAINT "AppNotification_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
