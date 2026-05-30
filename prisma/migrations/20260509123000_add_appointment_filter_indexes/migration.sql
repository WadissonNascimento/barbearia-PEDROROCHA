CREATE INDEX IF NOT EXISTS "Appointment_shopId_customerId_date_idx"
ON "Appointment"("shopId", "customerId", "date");

CREATE INDEX IF NOT EXISTS "Appointment_shopId_barberId_date_idx"
ON "Appointment"("shopId", "barberId", "date");
