-- Existing subscribers must explicitly confirm their billing details and method.
-- Do not modify payment statuses, amounts, historical due dates or usage credits.
ALTER TABLE "VipSubscription"
  ADD COLUMN "billingProfileConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "billingUpdateStartedAt" TIMESTAMP(3);
