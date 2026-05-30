ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Appointment_shopId_status_reminderSentAt_date_idx"
ON "Appointment"("shopId", "status", "reminderSentAt", "date");
