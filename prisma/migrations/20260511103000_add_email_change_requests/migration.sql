CREATE TABLE IF NOT EXISTS "EmailChangeRequest" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailChangeRequest_userId_key"
ON "EmailChangeRequest"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailChangeRequest_email_key"
ON "EmailChangeRequest"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailChangeRequest_id_shopId_key"
ON "EmailChangeRequest"("id", "shopId");

CREATE INDEX IF NOT EXISTS "EmailChangeRequest_shopId_email_expiresAt_idx"
ON "EmailChangeRequest"("shopId", "email", "expiresAt");

CREATE INDEX IF NOT EXISTS "EmailChangeRequest_shopId_userId_expiresAt_idx"
ON "EmailChangeRequest"("shopId", "userId", "expiresAt");

ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "EmailChangeRequest_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "EmailChangeRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."EmailChangeRequest" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."EmailChangeRequest" FROM anon;
REVOKE ALL ON TABLE public."EmailChangeRequest" FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."EmailChangeRequest" TO authenticated;

CREATE POLICY "EmailChangeRequest select owner or admin"
ON public."EmailChangeRequest"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "userId" = public.app_user_id());

CREATE POLICY "EmailChangeRequest insert owner"
ON public."EmailChangeRequest"
FOR INSERT
TO authenticated
WITH CHECK (
  "shopId" = public.app_shop_id()
  AND "userId" = public.app_user_id()
  AND btrim("email") <> ''
  AND btrim("code") <> ''
);

CREATE POLICY "EmailChangeRequest update owner"
ON public."EmailChangeRequest"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId") OR "userId" = public.app_user_id())
WITH CHECK (public.app_is_admin("shopId") OR "userId" = public.app_user_id());

CREATE POLICY "EmailChangeRequest delete owner"
ON public."EmailChangeRequest"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId") OR "userId" = public.app_user_id());
