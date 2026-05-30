ALTER TABLE public."Appointment"
  ADD COLUMN IF NOT EXISTS "isVipPlanUse" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vipSubscriptionId" TEXT;

CREATE TABLE IF NOT EXISTS public."VipPlan" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(12, 2) NOT NULL,
  "tokensPerCycle" INTEGER NOT NULL DEFAULT 4,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VipPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."VipSubscription" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
  "customerId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "tokensRemaining" INTEGER NOT NULL DEFAULT 4,
  "cycleStart" TIMESTAMP(3) NOT NULL,
  "cycleEnd" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VipSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."VipPayment" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
  "subscriptionId" TEXT NOT NULL,
  "cycleMonth" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VipPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."VipUsage" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_pedro_rocha_barbearia',
  "subscriptionId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "createdById" TEXT,
  "tokenAmount" INTEGER NOT NULL DEFAULT 1,
  "serviceLabel" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VipUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VipPlan_shopId_code_key" ON public."VipPlan"("shopId", "code");
CREATE INDEX IF NOT EXISTS "VipPlan_shopId_isActive_idx" ON public."VipPlan"("shopId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "VipSubscription_id_shopId_key" ON public."VipSubscription"("id", "shopId");
CREATE INDEX IF NOT EXISTS "VipSubscription_shopId_customerId_status_idx" ON public."VipSubscription"("shopId", "customerId", "status");
CREATE INDEX IF NOT EXISTS "VipSubscription_shopId_planId_idx" ON public."VipSubscription"("shopId", "planId");
CREATE INDEX IF NOT EXISTS "VipSubscription_shopId_cycleStart_cycleEnd_idx" ON public."VipSubscription"("shopId", "cycleStart", "cycleEnd");

CREATE UNIQUE INDEX IF NOT EXISTS "VipPayment_shopId_subscriptionId_cycleMonth_key" ON public."VipPayment"("shopId", "subscriptionId", "cycleMonth");
CREATE INDEX IF NOT EXISTS "VipPayment_shopId_status_cycleMonth_idx" ON public."VipPayment"("shopId", "status", "cycleMonth");

CREATE UNIQUE INDEX IF NOT EXISTS "VipUsage_appointmentId_key" ON public."VipUsage"("appointmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "VipUsage_id_shopId_key" ON public."VipUsage"("id", "shopId");
CREATE INDEX IF NOT EXISTS "VipUsage_shopId_subscriptionId_usedAt_idx" ON public."VipUsage"("shopId", "subscriptionId", "usedAt");
CREATE INDEX IF NOT EXISTS "VipUsage_shopId_customerId_usedAt_idx" ON public."VipUsage"("shopId", "customerId", "usedAt");

CREATE INDEX IF NOT EXISTS "Appointment_shopId_isVipPlanUse_date_idx" ON public."Appointment"("shopId", "isVipPlanUse", "date");
CREATE INDEX IF NOT EXISTS "Appointment_shopId_vipSubscriptionId_idx" ON public."Appointment"("shopId", "vipSubscriptionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipPlan_shopId_fkey') THEN
    ALTER TABLE public."VipPlan"
      ADD CONSTRAINT "VipPlan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipSubscription_shopId_fkey') THEN
    ALTER TABLE public."VipSubscription"
      ADD CONSTRAINT "VipSubscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipSubscription_customerId_fkey') THEN
    ALTER TABLE public."VipSubscription"
      ADD CONSTRAINT "VipSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipSubscription_planId_fkey') THEN
    ALTER TABLE public."VipSubscription"
      ADD CONSTRAINT "VipSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."VipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_vipSubscriptionId_fkey') THEN
    ALTER TABLE public."Appointment"
      ADD CONSTRAINT "Appointment_vipSubscriptionId_fkey" FOREIGN KEY ("vipSubscriptionId") REFERENCES public."VipSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipPayment_shopId_fkey') THEN
    ALTER TABLE public."VipPayment"
      ADD CONSTRAINT "VipPayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipPayment_subscriptionId_fkey') THEN
    ALTER TABLE public."VipPayment"
      ADD CONSTRAINT "VipPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public."VipSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipUsage_shopId_fkey') THEN
    ALTER TABLE public."VipUsage"
      ADD CONSTRAINT "VipUsage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipUsage_subscriptionId_fkey') THEN
    ALTER TABLE public."VipUsage"
      ADD CONSTRAINT "VipUsage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public."VipSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipUsage_appointmentId_fkey') THEN
    ALTER TABLE public."VipUsage"
      ADD CONSTRAINT "VipUsage_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public."Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipUsage_createdById_fkey') THEN
    ALTER TABLE public."VipUsage"
      ADD CONSTRAINT "VipUsage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
