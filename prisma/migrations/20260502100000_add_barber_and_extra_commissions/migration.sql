-- Commission rules per barber/service.
CREATE TABLE "BarberServiceCommission" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarberServiceCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BarberServiceCommission_barberId_serviceId_key" ON "BarberServiceCommission"("barberId", "serviceId");
CREATE INDEX "BarberServiceCommission_barberId_idx" ON "BarberServiceCommission"("barberId");
CREATE INDEX "BarberServiceCommission_serviceId_idx" ON "BarberServiceCommission"("serviceId");

ALTER TABLE "BarberServiceCommission"
ADD CONSTRAINT "BarberServiceCommission_barberId_fkey"
FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BarberServiceCommission"
ADD CONSTRAINT "BarberServiceCommission_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Product/extras commission is global for all barbers.
ALTER TABLE "ExtraProduct"
ADD COLUMN "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
ADD COLUMN "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Snapshot product commission on each appointment item to preserve history.
ALTER TABLE "AppointmentItem"
ADD COLUMN "commissionTypeSnapshot" TEXT NOT NULL DEFAULT 'PERCENT',
ADD COLUMN "commissionValueSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "barberPayoutSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "shopRevenueSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0;
