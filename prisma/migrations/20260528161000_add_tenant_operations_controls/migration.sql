ALTER TABLE "Shop" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN "barberLimit" INTEGER;

CREATE INDEX "Shop_isActive_archivedAt_idx" ON "Shop"("isActive", "archivedAt");
