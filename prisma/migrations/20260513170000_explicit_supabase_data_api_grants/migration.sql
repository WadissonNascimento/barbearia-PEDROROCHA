-- Explicit Supabase Data API grants.
-- Keeps RLS enabled and grants anon access only to public, column-limited data.

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

GRANT SELECT (
  "id",
  "name",
  "slug",
  "primaryDomain",
  "isDefault",
  "isActive",
  "metadataTitle",
  "metadataDescription",
  "whatsappNumber",
  "instagramUrl",
  "addressLine",
  "businessHours",
  "logoPath",
  "faviconPath",
  "brandColor",
  "brandColorStrong",
  "brandColorMuted",
  "createdAt",
  "updatedAt"
) ON public."Shop" TO anon;

GRANT SELECT (
  "id",
  "shopId",
  "name",
  "image",
  "role",
  "phone",
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."User" TO anon;

GRANT SELECT (
  "id",
  "shopId",
  "barberId",
  "name",
  "description",
  "price",
  "duration",
  "bufferAfter",
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."Service" TO anon;

GRANT SELECT (
  "id",
  "shopId",
  "barberId",
  "weekDay",
  "startTime",
  "endTime",
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."BarberAvailability" TO anon;

GRANT SELECT (
  "id",
  "shopId",
  "rating",
  "comment",
  "isVisible",
  "createdAt",
  "updatedAt"
) ON public."Review" TO anon;

GRANT SELECT (
  "id",
  "shopId",
  "name",
  "description",
  "category",
  "price",
  "imageUrl",
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."Product" TO anon;

GRANT SELECT (
  "id",
  "shopId",
  "name",
  "description",
  "category",
  "price",
  "imageUrl",
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."ExtraProduct" TO anon;

GRANT SELECT (
  "id",
  "shopId",
  "imageUrl",
  "position",
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."HomeImage" TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."Shop",
  public."Service",
  public."Appointment",
  public."AppointmentService",
  public."Review",
  public."BarberAvailability",
  public."BarberBlock",
  public."RecurringBarberBlock",
  public."ClientNote",
  public."CustomerProfile",
  public."Product",
  public."BarberServiceCommission",
  public."ExtraProduct",
  public."AppointmentItem",
  public."StockMovement",
  public."ExtraStockMovement",
  public."BarberPayout",
  public."BarberTip",
  public."HomeImage",
  public."EmailDeliveryLog",
  public."EmailChangeRequest"
TO authenticated;

GRANT SELECT (
  "id",
  "shopId",
  "name",
  "email",
  "emailVerified",
  "image",
  "role",
  "phone",
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."User" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public."User" TO authenticated;

DROP POLICY IF EXISTS "Anon public shop select active" ON public."Shop";
CREATE POLICY "Anon public shop select active"
ON public."Shop"
FOR SELECT
TO anon
USING ("isActive" = true);

DROP POLICY IF EXISTS "Anon public barber select active" ON public."User";
CREATE POLICY "Anon public barber select active"
ON public."User"
FOR SELECT
TO anon
USING (
  "role" = 'BARBER'
  AND "isActive" = true
  AND EXISTS (
    SELECT 1
    FROM public."Shop" s
    WHERE s.id = "User"."shopId"
      AND s."isActive" = true
  )
);

DROP POLICY IF EXISTS "Anon public service select active" ON public."Service";
CREATE POLICY "Anon public service select active"
ON public."Service"
FOR SELECT
TO anon
USING (
  "isActive" = true
  AND EXISTS (
    SELECT 1
    FROM public."Shop" s
    WHERE s.id = "Service"."shopId"
      AND s."isActive" = true
  )
);

DROP POLICY IF EXISTS "Anon public availability select active" ON public."BarberAvailability";
CREATE POLICY "Anon public availability select active"
ON public."BarberAvailability"
FOR SELECT
TO anon
USING (
  "isActive" = true
  AND EXISTS (
    SELECT 1
    FROM public."User" u
    JOIN public."Shop" s ON s.id = u."shopId"
    WHERE u.id = "BarberAvailability"."barberId"
      AND u."shopId" = "BarberAvailability"."shopId"
      AND u."role" = 'BARBER'
      AND u."isActive" = true
      AND s."isActive" = true
  )
);

DROP POLICY IF EXISTS "Anon public review select visible" ON public."Review";
CREATE POLICY "Anon public review select visible"
ON public."Review"
FOR SELECT
TO anon
USING (
  "isVisible" = true
  AND EXISTS (
    SELECT 1
    FROM public."Shop" s
    WHERE s.id = "Review"."shopId"
      AND s."isActive" = true
  )
);

DROP POLICY IF EXISTS "Anon public product select active" ON public."Product";
CREATE POLICY "Anon public product select active"
ON public."Product"
FOR SELECT
TO anon
USING (
  "isActive" = true
  AND EXISTS (
    SELECT 1
    FROM public."Shop" s
    WHERE s.id = "Product"."shopId"
      AND s."isActive" = true
  )
);

DROP POLICY IF EXISTS "Anon public extra product select active" ON public."ExtraProduct";
CREATE POLICY "Anon public extra product select active"
ON public."ExtraProduct"
FOR SELECT
TO anon
USING (
  "isActive" = true
  AND EXISTS (
    SELECT 1
    FROM public."Shop" s
    WHERE s.id = "ExtraProduct"."shopId"
      AND s."isActive" = true
  )
);

DROP POLICY IF EXISTS "Anon public home image select active" ON public."HomeImage";
CREATE POLICY "Anon public home image select active"
ON public."HomeImage"
FOR SELECT
TO anon
USING (
  "isActive" = true
  AND EXISTS (
    SELECT 1
    FROM public."Shop" s
    WHERE s.id = "HomeImage"."shopId"
      AND s."isActive" = true
  )
);

COMMIT;
