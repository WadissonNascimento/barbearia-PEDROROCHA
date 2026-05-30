CREATE TABLE IF NOT EXISTS "HomeImage" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "imageUrl" TEXT NOT NULL,
  "imagePath" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomeImage_id_shopId_key"
ON "HomeImage"("id", "shopId");

CREATE INDEX IF NOT EXISTS "HomeImage_shopId_isActive_position_idx"
ON "HomeImage"("shopId", "isActive", "position");

ALTER TABLE "HomeImage"
  ADD CONSTRAINT "HomeImage_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."HomeImage" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."HomeImage" FROM anon;
REVOKE ALL ON TABLE public."HomeImage" FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."HomeImage" TO authenticated;

CREATE POLICY "HomeImage select admin"
ON public."HomeImage"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "HomeImage insert admin"
ON public."HomeImage"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_is_admin("shopId")
  AND btrim("imageUrl") <> ''
  AND "imagePath" LIKE 'home/%'
  AND "position" >= 0
  AND "position" <= 4
);

CREATE POLICY "HomeImage update admin"
ON public."HomeImage"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (
  public.app_is_admin("shopId")
  AND btrim("imageUrl") <> ''
  AND "imagePath" LIKE 'home/%'
  AND "position" >= 0
  AND "position" <= 4
);

CREATE POLICY "HomeImage delete admin"
ON public."HomeImage"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));
