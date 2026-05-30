CREATE TABLE IF NOT EXISTS "Shop" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "primaryDomain" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadataTitle" TEXT,
  "metadataDescription" TEXT,
  "whatsappNumber" TEXT,
  "instagramUrl" TEXT,
  "addressLine" TEXT,
  "businessHours" TEXT,
  "logoPath" TEXT,
  "faviconPath" TEXT,
  "brandColor" TEXT,
  "brandColorStrong" TEXT,
  "brandColorMuted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Shop_slug_key" ON "Shop"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Shop_primaryDomain_key" ON "Shop"("primaryDomain");
CREATE INDEX IF NOT EXISTS "Shop_isActive_isDefault_idx" ON "Shop"("isActive", "isDefault");

INSERT INTO "Shop" (
  "id",
  "name",
  "slug",
  "primaryDomain",
  "isDefault",
  "isActive",
  "metadataTitle",
  "metadataDescription",
  "whatsappNumber",
  "instagramUrl",
  "addressLine",
  "businessHours",
  "logoPath",
  "faviconPath",
  "brandColor",
  "brandColorStrong",
  "brandColorMuted",
  "updatedAt"
) VALUES (
  'shop_jak_barber',
  'Jak Barber',
  'jak-barber',
  'jakbarbercompany.com',
  true,
  true,
  'Jak Barber | Barbearia com hora marcada',
  'Agende seu horario na Jak Barber, acompanhe seus atendimentos e encontre produtos para manter o cuidado em dia.',
  '5511961971267',
  'https://www.instagram.com/jakcompany_/',
  'Osasco, SP',
  'Terca a domingo, das 09h as 20h',
  '/logo.png',
  '/favicon.png?v=20260503-j',
  '#0ea5e9',
  '#7dd3fc',
  'rgba(14, 165, 233, 0.18)',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) THEN
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PendingRegistration'
  ) THEN
    ALTER TABLE "PendingRegistration" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PasswordResetRequest'
  ) THEN
    ALTER TABLE "PasswordResetRequest" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Service'
  ) THEN
    ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Appointment'
  ) THEN
    ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AppointmentService'
  ) THEN
    ALTER TABLE "AppointmentService" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Review'
  ) THEN
    ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'BarberAvailability'
  ) THEN
    ALTER TABLE "BarberAvailability" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'BarberBlock'
  ) THEN
    ALTER TABLE "BarberBlock" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'RecurringBarberBlock'
  ) THEN
    ALTER TABLE "RecurringBarberBlock" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ClientNote'
  ) THEN
    ALTER TABLE "ClientNote" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'CustomerProfile'
  ) THEN
    ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Product'
  ) THEN
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'BarberServiceCommission'
  ) THEN
    ALTER TABLE "BarberServiceCommission" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ExtraProduct'
  ) THEN
    ALTER TABLE "ExtraProduct" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AppointmentItem'
  ) THEN
    ALTER TABLE "AppointmentItem" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'StockMovement'
  ) THEN
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ExtraStockMovement'
  ) THEN
    ALTER TABLE "ExtraStockMovement" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'BarberPayout'
  ) THEN
    ALTER TABLE "BarberPayout" ADD COLUMN IF NOT EXISTS "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discountType" TEXT NOT NULL,
  "discountValue" DOUBLE PRECISION NOT NULL,
  "minOrderTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxDiscount" DOUBLE PRECISION,
  "expiresAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "timesUsed" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "customerId" TEXT NOT NULL,
  "couponId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "trackingCode" TEXT,
  "adminApproved" BOOLEAN NOT NULL DEFAULT false,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "shippingZipCode" TEXT,
  "shippingMethod" TEXT,
  "shippingAddress" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_id_shopId_key" ON "User"("id", "shopId");
CREATE INDEX IF NOT EXISTS "User_shopId_role_isActive_idx" ON "User"("shopId", "role", "isActive");
CREATE INDEX IF NOT EXISTS "User_shopId_createdAt_idx" ON "User"("shopId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PendingRegistration_id_shopId_key" ON "PendingRegistration"("id", "shopId");
CREATE INDEX IF NOT EXISTS "PendingRegistration_shopId_email_expiresAt_idx" ON "PendingRegistration"("shopId", "email", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetRequest_id_shopId_key" ON "PasswordResetRequest"("id", "shopId");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_shopId_email_expiresAt_idx" ON "PasswordResetRequest"("shopId", "email", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Service_id_shopId_key" ON "Service"("id", "shopId");
CREATE INDEX IF NOT EXISTS "Service_shopId_isActive_name_idx" ON "Service"("shopId", "isActive", "name");
CREATE INDEX IF NOT EXISTS "Service_shopId_barberId_isActive_idx" ON "Service"("shopId", "barberId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_id_shopId_key" ON "Appointment"("id", "shopId");
CREATE INDEX IF NOT EXISTS "Appointment_shopId_customerId_idx" ON "Appointment"("shopId", "customerId");
CREATE INDEX IF NOT EXISTS "Appointment_shopId_barberId_status_idx" ON "Appointment"("shopId", "barberId", "status");
CREATE INDEX IF NOT EXISTS "Appointment_shopId_date_idx" ON "Appointment"("shopId", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentService_id_shopId_key" ON "AppointmentService"("id", "shopId");
CREATE INDEX IF NOT EXISTS "AppointmentService_shopId_appointmentId_orderIndex_idx" ON "AppointmentService"("shopId", "appointmentId", "orderIndex");
CREATE INDEX IF NOT EXISTS "AppointmentService_shopId_serviceId_idx" ON "AppointmentService"("shopId", "serviceId");

CREATE UNIQUE INDEX IF NOT EXISTS "Review_id_shopId_key" ON "Review"("id", "shopId");
CREATE INDEX IF NOT EXISTS "Review_shopId_customerId_idx" ON "Review"("shopId", "customerId");
CREATE INDEX IF NOT EXISTS "Review_shopId_barberId_idx" ON "Review"("shopId", "barberId");
CREATE INDEX IF NOT EXISTS "Review_shopId_isVisible_createdAt_idx" ON "Review"("shopId", "isVisible", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "BarberAvailability_id_shopId_key" ON "BarberAvailability"("id", "shopId");
CREATE INDEX IF NOT EXISTS "BarberAvailability_shopId_barberId_weekDay_idx" ON "BarberAvailability"("shopId", "barberId", "weekDay");

CREATE UNIQUE INDEX IF NOT EXISTS "BarberBlock_id_shopId_key" ON "BarberBlock"("id", "shopId");
CREATE INDEX IF NOT EXISTS "BarberBlock_shopId_barberId_startDateTime_idx" ON "BarberBlock"("shopId", "barberId", "startDateTime");
CREATE INDEX IF NOT EXISTS "BarberBlock_shopId_barberId_endDateTime_idx" ON "BarberBlock"("shopId", "barberId", "endDateTime");

CREATE UNIQUE INDEX IF NOT EXISTS "RecurringBarberBlock_id_shopId_key" ON "RecurringBarberBlock"("id", "shopId");
CREATE INDEX IF NOT EXISTS "RecurringBarberBlock_shopId_barberId_weekDay_isActive_idx" ON "RecurringBarberBlock"("shopId", "barberId", "weekDay", "isActive");
CREATE INDEX IF NOT EXISTS "RecurringBarberBlock_shopId_barberId_isActive_idx" ON "RecurringBarberBlock"("shopId", "barberId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "ClientNote_id_shopId_key" ON "ClientNote"("id", "shopId");
CREATE INDEX IF NOT EXISTS "ClientNote_shopId_barberId_idx" ON "ClientNote"("shopId", "barberId");
CREATE INDEX IF NOT EXISTS "ClientNote_shopId_customerId_idx" ON "ClientNote"("shopId", "customerId");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerProfile_id_shopId_key" ON "CustomerProfile"("id", "shopId");
CREATE INDEX IF NOT EXISTS "CustomerProfile_shopId_preferredBarberId_idx" ON "CustomerProfile"("shopId", "preferredBarberId");

CREATE UNIQUE INDEX IF NOT EXISTS "Product_id_shopId_key" ON "Product"("id", "shopId");
CREATE INDEX IF NOT EXISTS "Product_shopId_isActive_createdAt_idx" ON "Product"("shopId", "isActive", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "BarberServiceCommission_id_shopId_key" ON "BarberServiceCommission"("id", "shopId");
CREATE INDEX IF NOT EXISTS "BarberServiceCommission_shopId_barberId_idx" ON "BarberServiceCommission"("shopId", "barberId");
CREATE INDEX IF NOT EXISTS "BarberServiceCommission_shopId_serviceId_idx" ON "BarberServiceCommission"("shopId", "serviceId");

CREATE UNIQUE INDEX IF NOT EXISTS "ExtraProduct_id_shopId_key" ON "ExtraProduct"("id", "shopId");
CREATE INDEX IF NOT EXISTS "ExtraProduct_shopId_isActive_createdAt_idx" ON "ExtraProduct"("shopId", "isActive", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentItem_id_shopId_key" ON "AppointmentItem"("id", "shopId");
CREATE INDEX IF NOT EXISTS "AppointmentItem_shopId_appointmentId_idx" ON "AppointmentItem"("shopId", "appointmentId");
CREATE INDEX IF NOT EXISTS "AppointmentItem_shopId_extraProductId_idx" ON "AppointmentItem"("shopId", "productId");

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_id_shopId_key" ON "Coupon"("id", "shopId");
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_shopId_code_isActive_idx" ON "Coupon"("shopId", "code", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "Order_id_shopId_key" ON "Order"("id", "shopId");
CREATE INDEX IF NOT EXISTS "Order_shopId_customerId_idx" ON "Order"("shopId", "customerId");
CREATE INDEX IF NOT EXISTS "Order_shopId_status_idx" ON "Order"("shopId", "status");
CREATE INDEX IF NOT EXISTS "Order_shopId_couponId_idx" ON "Order"("shopId", "couponId");

CREATE UNIQUE INDEX IF NOT EXISTS "OrderItem_id_shopId_key" ON "OrderItem"("id", "shopId");
CREATE INDEX IF NOT EXISTS "OrderItem_shopId_orderId_idx" ON "OrderItem"("shopId", "orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_shopId_productId_idx" ON "OrderItem"("shopId", "productId");

CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_id_shopId_key" ON "StockMovement"("id", "shopId");
CREATE INDEX IF NOT EXISTS "StockMovement_shopId_productId_createdAt_idx" ON "StockMovement"("shopId", "productId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_shopId_type_idx" ON "StockMovement"("shopId", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "ExtraStockMovement_id_shopId_key" ON "ExtraStockMovement"("id", "shopId");
CREATE INDEX IF NOT EXISTS "ExtraStockMovement_shopId_extraProductId_createdAt_idx" ON "ExtraStockMovement"("shopId", "extraProductId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExtraStockMovement_shopId_type_idx" ON "ExtraStockMovement"("shopId", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "BarberPayout_id_shopId_key" ON "BarberPayout"("id", "shopId");
CREATE INDEX IF NOT EXISTS "BarberPayout_shopId_barberId_status_idx" ON "BarberPayout"("shopId", "barberId", "status");
CREATE INDEX IF NOT EXISTS "BarberPayout_shopId_periodStart_periodEnd_idx" ON "BarberPayout"("shopId", "periodStart", "periodEnd");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_shopId_fkey') THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PendingRegistration_shopId_fkey') THEN
    ALTER TABLE "PendingRegistration"
      ADD CONSTRAINT "PendingRegistration_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetRequest_shopId_fkey') THEN
    ALTER TABLE "PasswordResetRequest"
      ADD CONSTRAINT "PasswordResetRequest_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_shopId_fkey') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_shopId_fkey') THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentService_shopId_fkey') THEN
    ALTER TABLE "AppointmentService"
      ADD CONSTRAINT "AppointmentService_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_shopId_fkey') THEN
    ALTER TABLE "Review"
      ADD CONSTRAINT "Review_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BarberAvailability_shopId_fkey') THEN
    ALTER TABLE "BarberAvailability"
      ADD CONSTRAINT "BarberAvailability_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BarberBlock_shopId_fkey') THEN
    ALTER TABLE "BarberBlock"
      ADD CONSTRAINT "BarberBlock_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringBarberBlock_shopId_fkey') THEN
    ALTER TABLE "RecurringBarberBlock"
      ADD CONSTRAINT "RecurringBarberBlock_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClientNote_shopId_fkey') THEN
    ALTER TABLE "ClientNote"
      ADD CONSTRAINT "ClientNote_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerProfile_shopId_fkey') THEN
    ALTER TABLE "CustomerProfile"
      ADD CONSTRAINT "CustomerProfile_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_shopId_fkey') THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BarberServiceCommission_shopId_fkey') THEN
    ALTER TABLE "BarberServiceCommission"
      ADD CONSTRAINT "BarberServiceCommission_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExtraProduct_shopId_fkey') THEN
    ALTER TABLE "ExtraProduct"
      ADD CONSTRAINT "ExtraProduct_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentItem_shopId_fkey') THEN
    ALTER TABLE "AppointmentItem"
      ADD CONSTRAINT "AppointmentItem_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_shopId_fkey') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_shopId_fkey') THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_customerId_fkey') THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_couponId_fkey') THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_couponId_fkey"
      FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_shopId_fkey') THEN
    ALTER TABLE "OrderItem"
      ADD CONSTRAINT "OrderItem_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_orderId_fkey') THEN
    ALTER TABLE "OrderItem"
      ADD CONSTRAINT "OrderItem_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_productId_fkey') THEN
    ALTER TABLE "OrderItem"
      ADD CONSTRAINT "OrderItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_shopId_fkey') THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExtraStockMovement_shopId_fkey') THEN
    ALTER TABLE "ExtraStockMovement"
      ADD CONSTRAINT "ExtraStockMovement_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BarberPayout_shopId_fkey') THEN
    ALTER TABLE "BarberPayout"
      ADD CONSTRAINT "BarberPayout_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
