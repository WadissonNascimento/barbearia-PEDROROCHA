ALTER TABLE "VipSubscription" ADD COLUMN "dueDay" INTEGER NOT NULL DEFAULT 5;

CREATE INDEX "VipSubscription_shopId_dueDay_idx" ON "VipSubscription"("shopId", "dueDay");
