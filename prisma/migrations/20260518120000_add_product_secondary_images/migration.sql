BEGIN;

CREATE TABLE IF NOT EXISTS public."ProductImage" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "productId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "image_path" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductImage_id_shopId_key"
ON public."ProductImage"("id", "shopId");

CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx"
ON public."ProductImage"("productId");

CREATE INDEX IF NOT EXISTS "ProductImage_shopId_idx"
ON public."ProductImage"("shopId");

CREATE INDEX IF NOT EXISTS "ProductImage_shopId_productId_idx"
ON public."ProductImage"("shopId", "productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductImage_shopId_fkey'
  ) THEN
    ALTER TABLE public."ProductImage"
      ADD CONSTRAINT "ProductImage_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES public."Shop"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductImage_productId_fkey'
  ) THEN
    ALTER TABLE public."ProductImage"
      ADD CONSTRAINT "ProductImage_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES public."Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE public."ProductImage" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."ProductImage" FROM anon;
REVOKE ALL ON TABLE public."ProductImage" FROM authenticated;

GRANT SELECT (
  "id",
  "shopId",
  "productId",
  "url",
  "order",
  "createdAt",
  "updatedAt"
) ON public."ProductImage" TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ProductImage" TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public."ProductImage" TO service_role;

DROP POLICY IF EXISTS "Anon public product image select active" ON public."ProductImage";
CREATE POLICY "Anon public product image select active"
ON public."ProductImage"
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public."Product" p
    JOIN public."Shop" s ON s.id = p."shopId"
    WHERE p.id = "ProductImage"."productId"
      AND p."shopId" = "ProductImage"."shopId"
      AND p."isActive" = true
      AND s."isActive" = true
  )
);

DROP POLICY IF EXISTS "ProductImage select active same tenant" ON public."ProductImage";
CREATE POLICY "ProductImage select active same tenant"
ON public."ProductImage"
FOR SELECT
TO authenticated
USING (
  "shopId" = public.app_shop_id()
  AND (
    public.app_is_admin("shopId")
    OR EXISTS (
      SELECT 1
      FROM public."Product" p
      WHERE p.id = "ProductImage"."productId"
        AND p."shopId" = "ProductImage"."shopId"
        AND p."isActive" = true
    )
  )
);

DROP POLICY IF EXISTS "ProductImage insert admin" ON public."ProductImage";
CREATE POLICY "ProductImage insert admin"
ON public."ProductImage"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_is_admin("shopId")
  AND btrim("url") <> ''
  AND ("image_path" IS NULL OR "image_path" LIKE 'products/%')
  AND "order" >= 0
  AND "order" <= 4
  AND EXISTS (
    SELECT 1
    FROM public."Product" p
    WHERE p.id = "ProductImage"."productId"
      AND p."shopId" = "ProductImage"."shopId"
  )
);

DROP POLICY IF EXISTS "ProductImage update admin" ON public."ProductImage";
CREATE POLICY "ProductImage update admin"
ON public."ProductImage"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (
  public.app_is_admin("shopId")
  AND btrim("url") <> ''
  AND ("image_path" IS NULL OR "image_path" LIKE 'products/%')
  AND "order" >= 0
  AND "order" <= 4
  AND EXISTS (
    SELECT 1
    FROM public."Product" p
    WHERE p.id = "ProductImage"."productId"
      AND p."shopId" = "ProductImage"."shopId"
  )
);

DROP POLICY IF EXISTS "ProductImage delete admin" ON public."ProductImage";
CREATE POLICY "ProductImage delete admin"
ON public."ProductImage"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

COMMIT;
