CREATE TABLE IF NOT EXISTS "EmailDeliveryLog" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "recipientUserId" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "subject" TEXT NOT NULL,
  "lastError" TEXT,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailDeliveryLog_shopId_template_eventKey_recipientEmail_key"
ON "EmailDeliveryLog"("shopId", "template", "eventKey", "recipientEmail");

CREATE INDEX IF NOT EXISTS "EmailDeliveryLog_shopId_recipientUserId_createdAt_idx"
ON "EmailDeliveryLog"("shopId", "recipientUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "EmailDeliveryLog_shopId_status_createdAt_idx"
ON "EmailDeliveryLog"("shopId", "status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'EmailDeliveryLog_shopId_fkey'
  ) THEN
    ALTER TABLE "EmailDeliveryLog"
    ADD CONSTRAINT "EmailDeliveryLog_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'EmailDeliveryLog_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "EmailDeliveryLog"
    ADD CONSTRAINT "EmailDeliveryLog_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE public."EmailDeliveryLog" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."EmailDeliveryLog" TO authenticated;

CREATE POLICY "EmailDeliveryLog admin select"
ON public."EmailDeliveryLog"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "EmailDeliveryLog admin insert"
ON public."EmailDeliveryLog"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "EmailDeliveryLog admin update"
ON public."EmailDeliveryLog"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "EmailDeliveryLog admin delete"
ON public."EmailDeliveryLog"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));
