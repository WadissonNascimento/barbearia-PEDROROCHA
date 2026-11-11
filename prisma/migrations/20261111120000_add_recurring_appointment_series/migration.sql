ALTER TABLE "Appointment"
ADD COLUMN "recurringSeriesId" TEXT,
ADD COLUMN "recurringBatchKey" TEXT,
ADD COLUMN "recurringOccurrenceDate" TIMESTAMP(3);

CREATE TABLE "RecurringAppointmentSeries" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "barberId" TEXT NOT NULL,
    "serviceIds" TEXT[] NOT NULL,
    "extras" JSONB,
    "time" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "unlimited" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "recurringBatchKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringAppointmentSeries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringAppointmentSeries_recurringBatchKey_key"
ON "RecurringAppointmentSeries"("recurringBatchKey");

CREATE UNIQUE INDEX "RecurringAppointmentSeries_id_shopId_key"
ON "RecurringAppointmentSeries"("id", "shopId");

CREATE INDEX "RecurringAppointmentSeries_shopId_status_idx"
ON "RecurringAppointmentSeries"("shopId", "status");

CREATE INDEX "RecurringAppointmentSeries_shopId_customerId_status_idx"
ON "RecurringAppointmentSeries"("shopId", "customerId", "status");

CREATE INDEX "RecurringAppointmentSeries_shopId_barberId_status_idx"
ON "RecurringAppointmentSeries"("shopId", "barberId", "status");

CREATE INDEX "Appointment_shopId_recurringSeriesId_date_idx"
ON "Appointment"("shopId", "recurringSeriesId", "date");

CREATE INDEX "Appointment_shopId_recurringBatchKey_idx"
ON "Appointment"("shopId", "recurringBatchKey");

CREATE UNIQUE INDEX "Appointment_recurringSeriesId_recurringOccurrenceDate_key"
ON "Appointment"("recurringSeriesId", "recurringOccurrenceDate");

ALTER TABLE "RecurringAppointmentSeries"
ADD CONSTRAINT "RecurringAppointmentSeries_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringAppointmentSeries"
ADD CONSTRAINT "RecurringAppointmentSeries_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringAppointmentSeries"
ADD CONSTRAINT "RecurringAppointmentSeries_barberId_fkey"
FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_recurringSeriesId_fkey"
FOREIGN KEY ("recurringSeriesId") REFERENCES "RecurringAppointmentSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
