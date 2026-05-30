ALTER TABLE "Appointment" ADD COLUMN "publicId" INTEGER;

WITH numbered_appointments AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "shopId"
      ORDER BY "createdAt", "id"
    )::INTEGER AS "nextPublicId"
  FROM "Appointment"
)
UPDATE "Appointment"
SET "publicId" = numbered_appointments."nextPublicId"
FROM numbered_appointments
WHERE "Appointment"."id" = numbered_appointments."id";

ALTER TABLE "Appointment" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "Appointment_shopId_publicId_key"
ON "Appointment"("shopId", "publicId");
