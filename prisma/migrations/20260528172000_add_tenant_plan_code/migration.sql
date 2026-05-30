ALTER TABLE "Shop" ADD COLUMN "planCode" TEXT;

UPDATE "Shop"
SET "planCode" = CASE
  WHEN "barberLimit" = 2 THEN 'basic'
  WHEN "barberLimit" = 5 THEN 'professional'
  WHEN "barberLimit" = 10 THEN 'premium'
  ELSE 'custom'
END
WHERE "planCode" IS NULL;
