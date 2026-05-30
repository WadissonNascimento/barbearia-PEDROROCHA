ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "isManualFitIn" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Appointment_shopId_barberId_isManualFitIn_date_idx"
ON "Appointment"("shopId", "barberId", "isManualFitIn", "date");
