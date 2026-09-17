ALTER TABLE "VipSubscription"
  ADD COLUMN "asaasCustomerId" TEXT,
  ADD COLUMN "asaasSubscriptionId" TEXT,
  ADD COLUMN "asaasBillingType" TEXT,
  ADD COLUMN "asaasStatus" TEXT,
  ADD COLUMN "lastAsaasSyncAt" TIMESTAMP(3);

ALTER TABLE "VipPayment"
  ADD COLUMN "asaasPaymentId" TEXT,
  ADD COLUMN "asaasStatus" TEXT,
  ADD COLUMN "invoiceUrl" TEXT,
  ADD COLUMN "bankSlipUrl" TEXT,
  ADD COLUMN "pixQrCode" TEXT,
  ADD COLUMN "pixCopyPaste" TEXT,
  ADD COLUMN "externalReference" TEXT,
  ADD COLUMN "lastAsaasEventAt" TIMESTAMP(3);

ALTER TABLE "CustomerProfile" ADD COLUMN "cpfCnpj" TEXT;

CREATE TABLE "AsaasWebhookEvent" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "asaasEventId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "asaasPaymentId" TEXT,
  "asaasSubscriptionId" TEXT,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "processingError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AsaasWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VipSubscription_asaasSubscriptionId_key" ON "VipSubscription"("asaasSubscriptionId");
CREATE INDEX "VipSubscription_shopId_asaasCustomerId_idx" ON "VipSubscription"("shopId", "asaasCustomerId");
CREATE INDEX "VipSubscription_shopId_asaasStatus_idx" ON "VipSubscription"("shopId", "asaasStatus");
CREATE UNIQUE INDEX "VipPayment_asaasPaymentId_key" ON "VipPayment"("asaasPaymentId");
CREATE INDEX "VipPayment_shopId_asaasStatus_idx" ON "VipPayment"("shopId", "asaasStatus");
CREATE UNIQUE INDEX "AsaasWebhookEvent_asaasEventId_key" ON "AsaasWebhookEvent"("asaasEventId");
CREATE INDEX "AsaasWebhookEvent_shopId_createdAt_idx" ON "AsaasWebhookEvent"("shopId", "createdAt");
CREATE INDEX "AsaasWebhookEvent_shopId_asaasPaymentId_idx" ON "AsaasWebhookEvent"("shopId", "asaasPaymentId");
CREATE INDEX "CustomerProfile_shopId_cpfCnpj_idx" ON "CustomerProfile"("shopId", "cpfCnpj");

ALTER TABLE "AsaasWebhookEvent"
  ADD CONSTRAINT "AsaasWebhookEvent_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
