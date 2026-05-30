-- Make identity records unique inside each shop instead of globally.
-- This allows the same e-mail or OAuth provider account to exist in different shops.

BEGIN;

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "shopId", email
    FROM public."User"
    WHERE email IS NOT NULL
    GROUP BY "shopId", email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply shop-scoped identity migration: duplicate User.email values exist inside the same shop.';
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "shopId", email
    FROM public."PendingRegistration"
    GROUP BY "shopId", email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply shop-scoped identity migration: duplicate PendingRegistration.email values exist inside the same shop.';
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "shopId", email
    FROM public."PasswordResetRequest"
    GROUP BY "shopId", email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply shop-scoped identity migration: duplicate PasswordResetRequest.email values exist inside the same shop.';
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "shopId", email
    FROM public."EmailChangeRequest"
    GROUP BY "shopId", email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply shop-scoped identity migration: duplicate EmailChangeRequest.email values exist inside the same shop.';
  END IF;
END $$;

ALTER TABLE public."Account"
  ADD COLUMN IF NOT EXISTS "shopId" TEXT;

UPDATE public."Account" a
SET "shopId" = u."shopId"
FROM public."User" u
WHERE a."userId" = u.id
  AND a."shopId" IS NULL;

UPDATE public."Account"
SET "shopId" = 'shop_jak_barber'
WHERE "shopId" IS NULL;

ALTER TABLE public."Account"
  ALTER COLUMN "shopId" SET DEFAULT 'shop_jak_barber',
  ALTER COLUMN "shopId" SET NOT NULL;

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "shopId", provider, "providerAccountId"
    FROM public."Account"
    GROUP BY "shopId", provider, "providerAccountId"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply shop-scoped identity migration: duplicate Account provider values exist inside the same shop.';
  END IF;
END $$;

ALTER TABLE public."Account"
  ADD CONSTRAINT "Account_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES public."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."Account_provider_providerAccountId_key";
DROP INDEX IF EXISTS public."PendingRegistration_email_key";
DROP INDEX IF EXISTS public."PasswordResetRequest_email_key";
DROP INDEX IF EXISTS public."EmailChangeRequest_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "User_shopId_email_key"
ON public."User"("shopId", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "Account_id_shopId_key"
ON public."Account"("id", "shopId");

CREATE UNIQUE INDEX IF NOT EXISTS "Account_shopId_provider_providerAccountId_key"
ON public."Account"("shopId", "provider", "providerAccountId");

CREATE INDEX IF NOT EXISTS "Account_shopId_userId_idx"
ON public."Account"("shopId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PendingRegistration_shopId_email_key"
ON public."PendingRegistration"("shopId", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetRequest_shopId_email_key"
ON public."PasswordResetRequest"("shopId", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailChangeRequest_shopId_email_key"
ON public."EmailChangeRequest"("shopId", "email");

REVOKE ALL ON TABLE public."Account" FROM anon;
REVOKE ALL ON TABLE public."Account" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Account" TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public."Account" TO service_role;

DROP POLICY IF EXISTS "Account select owner or admin" ON public."Account";
CREATE POLICY "Account select owner or admin"
ON public."Account"
FOR SELECT
TO authenticated
USING ("userId" = public.app_user_id() OR public.app_is_admin("shopId"));

DROP POLICY IF EXISTS "Account insert owner" ON public."Account";
CREATE POLICY "Account insert owner"
ON public."Account"
FOR INSERT
TO authenticated
WITH CHECK (
  "shopId" = public.app_shop_id()
  AND ("userId" = public.app_user_id() OR public.app_is_admin("shopId"))
);

DROP POLICY IF EXISTS "Account update owner or admin" ON public."Account";
CREATE POLICY "Account update owner or admin"
ON public."Account"
FOR UPDATE
TO authenticated
USING ("userId" = public.app_user_id() OR public.app_is_admin("shopId"))
WITH CHECK (
  "shopId" = public.app_shop_id()
  AND ("userId" = public.app_user_id() OR public.app_is_admin("shopId"))
);

DROP POLICY IF EXISTS "Account delete owner or admin" ON public."Account";
CREATE POLICY "Account delete owner or admin"
ON public."Account"
FOR DELETE
TO authenticated
USING ("userId" = public.app_user_id() OR public.app_is_admin("shopId"));

COMMIT;
