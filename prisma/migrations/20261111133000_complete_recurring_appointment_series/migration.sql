ALTER TABLE "RecurringAppointmentSeries"
ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT,
ADD COLUMN IF NOT EXISTS "repeatForever" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "intervalDays" INTEGER,
ADD COLUMN IF NOT EXISTS "nextDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "conflicts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "useVipPlan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "vipSubscriptionId" TEXT,
ADD COLUMN IF NOT EXISTS "vipPlanName" TEXT;

CREATE INDEX IF NOT EXISTS "RecurringAppointmentSeries_shopId_nextDate_status_idx"
ON "RecurringAppointmentSeries"("shopId", "nextDate", "status");

CREATE INDEX IF NOT EXISTS "RecurringAppointmentSeries_shopId_vipSubscriptionId_idx"
ON "RecurringAppointmentSeries"("shopId", "vipSubscriptionId");
