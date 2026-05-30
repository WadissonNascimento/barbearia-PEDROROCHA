DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExtraCategory') THEN
    CREATE TYPE "ExtraCategory" AS ENUM ('BEVERAGE', 'SHELF', 'OTHER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ExtraProduct" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "ExtraCategory" NOT NULL DEFAULT 'OTHER',
  "price" DOUBLE PRECISION NOT NULL,
  "imageUrl" TEXT,
  "image_path" TEXT,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExtraProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExtraStockMovement" (
  "id" TEXT NOT NULL,
  "extraProductId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtraStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExtraStockMovement_extraProductId_createdAt_idx"
  ON "ExtraStockMovement"("extraProductId", "createdAt");

CREATE INDEX IF NOT EXISTS "ExtraStockMovement_type_idx"
  ON "ExtraStockMovement"("type");

ALTER TABLE "ExtraStockMovement"
  DROP CONSTRAINT IF EXISTS "ExtraStockMovement_extraProductId_fkey";

ALTER TABLE "ExtraStockMovement"
  ADD CONSTRAINT "ExtraStockMovement_extraProductId_fkey"
  FOREIGN KEY ("extraProductId") REFERENCES "ExtraProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentItem"
  DROP CONSTRAINT IF EXISTS "AppointmentItem_productId_fkey";

ALTER TABLE "AppointmentItem"
  ADD CONSTRAINT "AppointmentItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ExtraProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
