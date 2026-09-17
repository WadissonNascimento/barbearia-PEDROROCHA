ALTER TABLE "VipSubscription" ADD COLUMN "asaasFirstDueDate" TIMESTAMP(3);
ALTER TABLE "Shop" ALTER COLUMN "vipEnrollmentOpen" SET DEFAULT false;
UPDATE "Shop" SET "vipEnrollmentOpen" = false WHERE "id" = 'shop_pedro_rocha_barbearia';
