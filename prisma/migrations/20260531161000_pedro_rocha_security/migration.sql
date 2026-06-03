-- Supabase RLS, public reads and server-side appointment numbering.
BEGIN;

CREATE OR REPLACE FUNCTION public.app_jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), ''),
    public.app_jwt_claims() #>> '{app_metadata,userId}',
    public.app_jwt_claims() #>> '{user_metadata,userId}',
    public.app_jwt_claims() ->> 'sub'
  )
$$;

CREATE OR REPLACE FUNCTION public.app_shop_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_shop_id', true), ''),
    public.app_jwt_claims() #>> '{app_metadata,shopId}',
    public.app_jwt_claims() #>> '{user_metadata,shopId}'
  )
$$;

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT UPPER(COALESCE(
    NULLIF(current_setting('app.current_role', true), ''),
    public.app_jwt_claims() #>> '{app_metadata,role}',
    public.app_jwt_claims() #>> '{user_metadata,role}',
    ''
  ))
$$;

CREATE OR REPLACE FUNCTION public.app_has_role(target_shop_id text, target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      public.app_shop_id() = target_shop_id
      AND (
        public.app_role() = UPPER(target_role)
        OR (UPPER(target_role) = 'ADMIN' AND public.app_role() = 'SHOP_ADMIN')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public."User" u
      WHERE u.id = public.app_user_id()
        AND u."shopId" = target_shop_id
        AND (
          u.role = UPPER(target_role)
          OR (UPPER(target_role) = 'ADMIN' AND u.role = 'SHOP_ADMIN')
        )
        AND u."isActive" = true
    )
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin(target_shop_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_has_role(target_shop_id, 'ADMIN')
$$;

CREATE OR REPLACE FUNCTION public.app_is_barber(target_shop_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_has_role(target_shop_id, 'BARBER')
$$;

CREATE OR REPLACE FUNCTION public."setAppointmentPublicId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."publicId" IS NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(NEW."shopId"),
      hashtext('appointment_public_id')
    );

    SELECT COALESCE(MAX("publicId"), 0) + 1
    INTO NEW."publicId"
    FROM public."Appointment"
    WHERE "shopId" = NEW."shopId";
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "appointmentPublicIdBeforeInsert" ON public."Appointment";
CREATE TRIGGER "appointmentPublicIdBeforeInsert"
BEFORE INSERT ON public."Appointment"
FOR EACH ROW
EXECUTE FUNCTION public."setAppointmentPublicId"();

DO $$
DECLARE
  app_table text;
BEGIN
  FOR app_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

GRANT SELECT (
  "id", "name", "slug", "primaryDomain", "isDefault", "isActive",
  "metadataTitle", "metadataDescription", "whatsappNumber", "instagramUrl",
  "addressLine", "businessHours", "logoPath", "faviconPath", "brandColor",
  "brandColorStrong", "brandColorMuted", "createdAt", "updatedAt"
) ON public."Shop" TO anon;

GRANT SELECT (
  "id", "shopId", "name", "image", "role", "phone", "isActive",
  "createdAt", "updatedAt"
) ON public."User" TO anon;

GRANT SELECT (
  "id", "shopId", "barberId", "name", "description", "price", "duration",
  "bufferAfter", "isActive", "createdAt", "updatedAt"
) ON public."Service" TO anon;

GRANT SELECT (
  "id", "shopId", "rating", "comment", "isVisible", "createdAt", "updatedAt"
) ON public."Review" TO anon;

GRANT SELECT (
  "id", "shopId", "imageUrl", "position", "isActive", "createdAt", "updatedAt"
) ON public."HomeImage" TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

DROP POLICY IF EXISTS "Anon public shop select active" ON public."Shop";
CREATE POLICY "Anon public shop select active"
ON public."Shop"
FOR SELECT TO anon
USING ("isActive" = true);

DROP POLICY IF EXISTS "Anon public barber select active" ON public."User";
CREATE POLICY "Anon public barber select active"
ON public."User"
FOR SELECT TO anon
USING ("role" = 'BARBER' AND "isActive" = true);

DROP POLICY IF EXISTS "Anon public service select active" ON public."Service";
CREATE POLICY "Anon public service select active"
ON public."Service"
FOR SELECT TO anon
USING ("isActive" = true);

DROP POLICY IF EXISTS "Anon public review select visible" ON public."Review";
CREATE POLICY "Anon public review select visible"
ON public."Review"
FOR SELECT TO anon
USING ("isVisible" = true);

DROP POLICY IF EXISTS "Anon public home image select active" ON public."HomeImage";
CREATE POLICY "Anon public home image select active"
ON public."HomeImage"
FOR SELECT TO anon
USING ("isActive" = true);

DROP POLICY IF EXISTS "Appointment select related" ON public."Appointment";
CREATE POLICY "Appointment select related"
ON public."Appointment"
FOR SELECT TO authenticated
USING (
  public.app_is_admin("shopId")
  OR "customerId" = public.app_user_id()
  OR "barberId" = public.app_user_id()
);

DROP POLICY IF EXISTS "Appointment insert customer own" ON public."Appointment";
CREATE POLICY "Appointment insert customer own"
ON public."Appointment"
FOR INSERT TO authenticated
WITH CHECK (
  "shopId" = public.app_shop_id()
  AND "customerId" = public.app_user_id()
);

DROP POLICY IF EXISTS "EmailDeliveryLog admin select" ON public."EmailDeliveryLog";
CREATE POLICY "EmailDeliveryLog admin select"
ON public."EmailDeliveryLog"
FOR SELECT TO authenticated
USING (public.app_is_admin("shopId"));

COMMIT;
