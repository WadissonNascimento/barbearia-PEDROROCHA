CREATE TABLE IF NOT EXISTS "BarberTip" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL DEFAULT 'shop_jak_barber',
  "barberId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BarberTip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BarberTip_id_shopId_key"
ON "BarberTip"("id", "shopId");

CREATE INDEX IF NOT EXISTS "BarberTip_shopId_barberId_idx"
ON "BarberTip"("shopId", "barberId");

CREATE INDEX IF NOT EXISTS "BarberTip_shopId_createdAt_idx"
ON "BarberTip"("shopId", "createdAt");

CREATE INDEX IF NOT EXISTS "BarberTip_shopId_barberId_createdAt_idx"
ON "BarberTip"("shopId", "barberId", "createdAt");

ALTER TABLE "BarberTip"
  ADD CONSTRAINT "BarberTip_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BarberTip"
  ADD CONSTRAINT "BarberTip_barberId_fkey"
  FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."BarberTip" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."BarberTip" FROM anon;
REVOKE ALL ON TABLE public."BarberTip" FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."BarberTip" TO authenticated;

CREATE POLICY "BarberTip select admin or owner"
ON public."BarberTip"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "BarberTip insert owner"
ON public."BarberTip"
FOR INSERT
TO authenticated
WITH CHECK (
  "shopId" = public.app_shop_id()
  AND public.app_is_barber("shopId")
  AND "barberId" = public.app_user_id()
  AND "amount" > 0
  AND btrim("clientName") <> ''
);

CREATE POLICY "BarberTip update admin"
ON public."BarberTip"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "BarberTip delete admin"
ON public."BarberTip"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));
