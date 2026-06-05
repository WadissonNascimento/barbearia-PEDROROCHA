ALTER TABLE "VipPayment" ADD COLUMN "dueDate" TIMESTAMP(3);

CREATE INDEX "VipPayment_shopId_dueDate_idx" ON "VipPayment"("shopId", "dueDate");
