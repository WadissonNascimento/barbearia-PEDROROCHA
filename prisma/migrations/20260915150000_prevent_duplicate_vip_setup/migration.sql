CREATE UNIQUE INDEX "VipSubscription_one_setup_per_customer"
ON "VipSubscription" ("shopId", "customerId")
WHERE "status" = 'SETUP';
