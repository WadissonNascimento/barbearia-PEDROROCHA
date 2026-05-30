CREATE TABLE IF NOT EXISTS "ShopEmailSettings" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "fromName" TEXT,
  "replyToEmail" TEXT,
  "notificationEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopEmailSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopEmailSettings_shopId_key"
ON "ShopEmailSettings"("shopId");

ALTER TABLE "ShopEmailSettings"
  ADD CONSTRAINT "ShopEmailSettings_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ShopEmailSettings" (
  "id",
  "shopId",
  "fromName",
  "replyToEmail",
  "notificationEmail",
  "createdAt",
  "updatedAt"
)
SELECT
  'shop_email_settings_' || s."id",
  s."id",
  CASE
    WHEN s."id" = 'shop_jak_barber' THEN 'Jak Barber'
    WHEN s."id" = 'shop_rodrigo_style' OR s."slug" = 'rodrigo-style' THEN 'Rodrigo Style'
    ELSE s."name"
  END,
  CASE
    WHEN s."id" = 'shop_jak_barber' THEN 'jakcompanybarbearia@gmail.com'
    WHEN s."id" = 'shop_rodrigo_style' OR s."slug" = 'rodrigo-style' THEN 'rodrigostylebarbearia@gmail.com'
    ELSE NULL
  END,
  CASE
    WHEN s."id" = 'shop_jak_barber' THEN 'jakcompanybarbearia@gmail.com'
    WHEN s."id" = 'shop_rodrigo_style' OR s."slug" = 'rodrigo-style' THEN 'rodrigostylebarbearia@gmail.com'
    ELSE NULL
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Shop" s
WHERE s."id" IN ('shop_jak_barber', 'shop_rodrigo_style')
   OR s."slug" = 'rodrigo-style'
ON CONFLICT ("shopId") DO UPDATE SET
  "fromName" = EXCLUDED."fromName",
  "replyToEmail" = EXCLUDED."replyToEmail",
  "notificationEmail" = EXCLUDED."notificationEmail",
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE public."ShopEmailSettings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."ShopEmailSettings" FROM anon;
REVOKE ALL ON TABLE public."ShopEmailSettings" FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ShopEmailSettings" TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public."ShopEmailSettings" TO service_role;

CREATE POLICY "ShopEmailSettings select admin"
ON public."ShopEmailSettings"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "ShopEmailSettings insert admin"
ON public."ShopEmailSettings"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "ShopEmailSettings update admin"
ON public."ShopEmailSettings"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "ShopEmailSettings delete admin"
ON public."ShopEmailSettings"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));
