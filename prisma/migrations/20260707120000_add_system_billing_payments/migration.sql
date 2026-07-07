-- CreateTable
CREATE TABLE "SystemBillingPayment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
    "cycleMonth" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "graceEndsAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemBillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemBillingPayment_id_shopId_key" ON "SystemBillingPayment"("id", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemBillingPayment_shopId_cycleMonth_key" ON "SystemBillingPayment"("shopId", "cycleMonth");

-- CreateIndex
CREATE INDEX "SystemBillingPayment_shopId_status_dueDate_idx" ON "SystemBillingPayment"("shopId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "SystemBillingPayment_shopId_paidByUserId_idx" ON "SystemBillingPayment"("shopId", "paidByUserId");

-- AddForeignKey
ALTER TABLE "SystemBillingPayment" ADD CONSTRAINT "SystemBillingPayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemBillingPayment" ADD CONSTRAINT "SystemBillingPayment_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
