DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductCategory') THEN
    CREATE TYPE "ProductCategory" AS ENUM ('BEVERAGE', 'SHELF', 'OTHER');
  END IF;
END $$;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "category" "ProductCategory" NOT NULL DEFAULT 'OTHER';

CREATE TABLE IF NOT EXISTS "AppointmentItem" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "subtotal" DOUBLE PRECISION NOT NULL,
  "isDelivered" BOOLEAN NOT NULL DEFAULT false,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppointmentItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppointmentItem_appointmentId_idx" ON "AppointmentItem"("appointmentId");
CREATE INDEX IF NOT EXISTS "AppointmentItem_productId_idx" ON "AppointmentItem"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'AppointmentItem_appointmentId_fkey'
  ) THEN
    ALTER TABLE "AppointmentItem"
    ADD CONSTRAINT "AppointmentItem_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'AppointmentItem_productId_fkey'
  ) THEN
    ALTER TABLE "AppointmentItem"
    ADD CONSTRAINT "AppointmentItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
