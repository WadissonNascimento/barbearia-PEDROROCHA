-- Enable Supabase/Postgres row level security for application data.
-- The application currently uses Prisma on the server. These policies protect
-- direct Supabase/PostgREST access and require app JWT claims or session GUCs:
-- app.current_user_id, app.current_shop_id, app.current_role.

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
      AND public.app_role() = UPPER(target_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public."User" u
      WHERE u.id = public.app_user_id()
        AND u."shopId" = target_shop_id
        AND u.role = UPPER(target_role)
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

CREATE OR REPLACE FUNCTION public.app_is_customer(target_shop_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_has_role(target_shop_id, 'CUSTOMER')
$$;

CREATE OR REPLACE FUNCTION public.app_is_active_barber_in_shop(
  target_barber_id text,
  target_shop_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."User" u
    WHERE u.id = target_barber_id
      AND u."shopId" = target_shop_id
      AND u.role = 'BARBER'
      AND u."isActive" = true
  )
$$;

CREATE OR REPLACE FUNCTION public.app_is_related_customer(
  target_shop_id text,
  target_customer_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_is_barber(target_shop_id)
    AND EXISTS (
      SELECT 1
      FROM public."Appointment" a
      WHERE a."shopId" = target_shop_id
        AND a."barberId" = public.app_user_id()
        AND a."customerId" = target_customer_id
    )
$$;

CREATE OR REPLACE FUNCTION public.app_can_access_appointment(target_appointment_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Appointment" a
    WHERE a.id = target_appointment_id
      AND (
        public.app_is_admin(a."shopId")
        OR a."customerId" = public.app_user_id()
        OR a."barberId" = public.app_user_id()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.app_can_manage_appointment(target_appointment_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Appointment" a
    WHERE a.id = target_appointment_id
      AND (
        public.app_is_admin(a."shopId")
        OR (
          public.app_is_barber(a."shopId")
          AND a."barberId" = public.app_user_id()
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.app_can_access_order(target_order_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Order" o
    WHERE o.id = target_order_id
      AND (
        public.app_is_admin(o."shopId")
        OR o."customerId" = public.app_user_id()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.app_can_insert_review(
  target_appointment_id text,
  target_shop_id text,
  target_customer_id text,
  target_barber_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Appointment" a
    WHERE a.id = target_appointment_id
      AND a."shopId" = target_shop_id
      AND a."customerId" = target_customer_id
      AND a."barberId" = target_barber_id
      AND a."customerId" = public.app_user_id()
      AND a.status IN ('COMPLETED', 'DONE')
  )
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Shop',
    'User',
    'Account',
    'Session',
    'VerificationToken',
    'PendingRegistration',
    'PasswordResetRequest',
    'Service',
    'Appointment',
    'AppointmentService',
    'Review',
    'BarberAvailability',
    'BarberBlock',
    'RecurringBarberBlock',
    'ClientNote',
    'CustomerProfile',
    'Product',
    'BarberServiceCommission',
    'ExtraProduct',
    'AppointmentItem',
    'Order',
    'OrderItem',
    'Coupon',
    'StockMovement',
    'ExtraStockMovement',
    'BarberPayout'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

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
  public."Order",
  public."OrderItem",
  public."Coupon",
  public."StockMovement",
  public."ExtraStockMovement",
  public."BarberPayout"
TO authenticated;

GRANT SELECT (
  id,
  "shopId",
  name,
  email,
  "emailVerified",
  image,
  role,
  phone,
  "isActive",
  "createdAt",
  "updatedAt"
) ON public."User" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public."User" TO authenticated;

CREATE POLICY "Shop select same tenant"
ON public."Shop"
FOR SELECT
TO authenticated
USING (id = public.app_shop_id() OR public.app_is_admin(id));

CREATE POLICY "Shop update admin"
ON public."Shop"
FOR UPDATE
TO authenticated
USING (public.app_is_admin(id))
WITH CHECK (public.app_is_admin(id));

CREATE POLICY "User select scoped"
ON public."User"
FOR SELECT
TO authenticated
USING (
  id = public.app_user_id()
  OR public.app_is_admin("shopId")
  OR (
    role = 'CUSTOMER'
    AND public.app_is_related_customer("shopId", id)
  )
);

CREATE POLICY "User insert admin same tenant"
ON public."User"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "User update admin same tenant"
ON public."User"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "User delete admin same tenant"
ON public."User"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "Service select same tenant"
ON public."Service"
FOR SELECT
TO authenticated
USING (
  "shopId" = public.app_shop_id()
  AND ("isActive" = true OR public.app_is_admin("shopId") OR public.app_is_barber("shopId"))
);

CREATE POLICY "Service insert admin"
ON public."Service"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_is_admin("shopId")
  AND ("barberId" IS NULL OR public.app_is_active_barber_in_shop("barberId", "shopId"))
);

CREATE POLICY "Service update admin"
ON public."Service"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (
  public.app_is_admin("shopId")
  AND ("barberId" IS NULL OR public.app_is_active_barber_in_shop("barberId", "shopId"))
);

CREATE POLICY "Service delete admin"
ON public."Service"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "Appointment select related"
ON public."Appointment"
FOR SELECT
TO authenticated
USING (
  public.app_is_admin("shopId")
  OR "customerId" = public.app_user_id()
  OR "barberId" = public.app_user_id()
);

CREATE POLICY "Appointment insert customer own"
ON public."Appointment"
FOR INSERT
TO authenticated
WITH CHECK (
  "shopId" = public.app_shop_id()
  AND "customerId" = public.app_user_id()
  AND public.app_is_active_barber_in_shop("barberId", "shopId")
);

CREATE POLICY "Appointment update admin or barber"
ON public."Appointment"
FOR UPDATE
TO authenticated
USING (
  public.app_is_admin("shopId")
  OR (
    public.app_is_barber("shopId")
    AND "barberId" = public.app_user_id()
  )
)
WITH CHECK (
  public.app_is_admin("shopId")
  OR (
    public.app_is_barber("shopId")
    AND "barberId" = public.app_user_id()
  )
);

CREATE POLICY "Appointment delete admin"
ON public."Appointment"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "AppointmentService select appointment related"
ON public."AppointmentService"
FOR SELECT
TO authenticated
USING (public.app_can_access_appointment("appointmentId"));

CREATE POLICY "AppointmentService insert appointment manager"
ON public."AppointmentService"
FOR INSERT
TO authenticated
WITH CHECK (public.app_can_manage_appointment("appointmentId"));

CREATE POLICY "AppointmentService update appointment manager"
ON public."AppointmentService"
FOR UPDATE
TO authenticated
USING (public.app_can_manage_appointment("appointmentId"))
WITH CHECK (public.app_can_manage_appointment("appointmentId"));

CREATE POLICY "AppointmentService delete appointment manager"
ON public."AppointmentService"
FOR DELETE
TO authenticated
USING (public.app_can_manage_appointment("appointmentId"));

CREATE POLICY "AppointmentItem select appointment related"
ON public."AppointmentItem"
FOR SELECT
TO authenticated
USING (public.app_can_access_appointment("appointmentId"));

CREATE POLICY "AppointmentItem insert appointment manager"
ON public."AppointmentItem"
FOR INSERT
TO authenticated
WITH CHECK (public.app_can_manage_appointment("appointmentId"));

CREATE POLICY "AppointmentItem update appointment manager"
ON public."AppointmentItem"
FOR UPDATE
TO authenticated
USING (public.app_can_manage_appointment("appointmentId"))
WITH CHECK (public.app_can_manage_appointment("appointmentId"));

CREATE POLICY "AppointmentItem delete appointment manager"
ON public."AppointmentItem"
FOR DELETE
TO authenticated
USING (public.app_can_manage_appointment("appointmentId"));

CREATE POLICY "Review select visible or related"
ON public."Review"
FOR SELECT
TO authenticated
USING (
  ("shopId" = public.app_shop_id() AND "isVisible" = true)
  OR public.app_is_admin("shopId")
  OR "customerId" = public.app_user_id()
  OR "barberId" = public.app_user_id()
);

CREATE POLICY "Review insert completed customer appointment"
ON public."Review"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_can_insert_review("appointmentId", "shopId", "customerId", "barberId")
);

CREATE POLICY "Review update admin"
ON public."Review"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "Review delete admin"
ON public."Review"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "BarberAvailability select admin or owner"
ON public."BarberAvailability"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "BarberAvailability insert admin or owner"
ON public."BarberAvailability"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "BarberAvailability update admin or owner"
ON public."BarberAvailability"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id())
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "BarberAvailability delete admin or owner"
ON public."BarberAvailability"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "BarberBlock select admin or owner"
ON public."BarberBlock"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "BarberBlock insert admin or owner"
ON public."BarberBlock"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "BarberBlock update admin or owner"
ON public."BarberBlock"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id())
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "BarberBlock delete admin or owner"
ON public."BarberBlock"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "RecurringBarberBlock select admin or owner"
ON public."RecurringBarberBlock"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "RecurringBarberBlock insert admin or owner"
ON public."RecurringBarberBlock"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "RecurringBarberBlock update admin or owner"
ON public."RecurringBarberBlock"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id())
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "RecurringBarberBlock delete admin or owner"
ON public."RecurringBarberBlock"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "ClientNote select admin or barber owner"
ON public."ClientNote"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "ClientNote insert admin or barber owner"
ON public."ClientNote"
FOR INSERT
TO authenticated
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "ClientNote update admin or barber owner"
ON public."ClientNote"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id())
WITH CHECK (
  public.app_is_admin("shopId")
  OR (public.app_is_barber("shopId") AND "barberId" = public.app_user_id())
);

CREATE POLICY "ClientNote delete admin or barber owner"
ON public."ClientNote"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "CustomerProfile select owner admin or related barber"
ON public."CustomerProfile"
FOR SELECT
TO authenticated
USING (
  "customerId" = public.app_user_id()
  OR public.app_is_admin("shopId")
  OR public.app_is_related_customer("shopId", "customerId")
);

CREATE POLICY "CustomerProfile insert owner or admin"
ON public."CustomerProfile"
FOR INSERT
TO authenticated
WITH CHECK (
  (
    "customerId" = public.app_user_id()
    AND "shopId" = public.app_shop_id()
  )
  OR public.app_is_admin("shopId")
);

CREATE POLICY "CustomerProfile update owner or admin"
ON public."CustomerProfile"
FOR UPDATE
TO authenticated
USING ("customerId" = public.app_user_id() OR public.app_is_admin("shopId"))
WITH CHECK (
  (
    "customerId" = public.app_user_id()
    AND "shopId" = public.app_shop_id()
    AND (
      "preferredBarberId" IS NULL
      OR public.app_is_active_barber_in_shop("preferredBarberId", "shopId")
    )
  )
  OR public.app_is_admin("shopId")
);

CREATE POLICY "CustomerProfile delete admin"
ON public."CustomerProfile"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "Product select active same tenant"
ON public."Product"
FOR SELECT
TO authenticated
USING ("shopId" = public.app_shop_id() AND ("isActive" = true OR public.app_is_admin("shopId")));

CREATE POLICY "Product insert admin"
ON public."Product"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "Product update admin"
ON public."Product"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "Product delete admin"
ON public."Product"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "ExtraProduct select active same tenant"
ON public."ExtraProduct"
FOR SELECT
TO authenticated
USING ("shopId" = public.app_shop_id() AND ("isActive" = true OR public.app_is_admin("shopId")));

CREATE POLICY "ExtraProduct insert admin"
ON public."ExtraProduct"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "ExtraProduct update admin"
ON public."ExtraProduct"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "ExtraProduct delete admin"
ON public."ExtraProduct"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "BarberServiceCommission select admin or owner"
ON public."BarberServiceCommission"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "BarberServiceCommission insert admin"
ON public."BarberServiceCommission"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "BarberServiceCommission update admin"
ON public."BarberServiceCommission"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "BarberServiceCommission delete admin"
ON public."BarberServiceCommission"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "Order select owner or admin"
ON public."Order"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "customerId" = public.app_user_id());

CREATE POLICY "Order insert customer own"
ON public."Order"
FOR INSERT
TO authenticated
WITH CHECK ("shopId" = public.app_shop_id() AND "customerId" = public.app_user_id());

CREATE POLICY "Order update admin"
ON public."Order"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "Order delete admin"
ON public."Order"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "OrderItem select order related"
ON public."OrderItem"
FOR SELECT
TO authenticated
USING (public.app_can_access_order("orderId"));

CREATE POLICY "OrderItem insert order related"
ON public."OrderItem"
FOR INSERT
TO authenticated
WITH CHECK (public.app_can_access_order("orderId"));

CREATE POLICY "OrderItem update admin"
ON public."OrderItem"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "OrderItem delete admin"
ON public."OrderItem"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "Coupon select active same tenant"
ON public."Coupon"
FOR SELECT
TO authenticated
USING ("shopId" = public.app_shop_id() AND ("isActive" = true OR public.app_is_admin("shopId")));

CREATE POLICY "Coupon insert admin"
ON public."Coupon"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "Coupon update admin"
ON public."Coupon"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "Coupon delete admin"
ON public."Coupon"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "StockMovement select admin"
ON public."StockMovement"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "StockMovement insert admin"
ON public."StockMovement"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "StockMovement update admin"
ON public."StockMovement"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "StockMovement delete admin"
ON public."StockMovement"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "ExtraStockMovement select admin"
ON public."ExtraStockMovement"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "ExtraStockMovement insert admin"
ON public."ExtraStockMovement"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "ExtraStockMovement update admin"
ON public."ExtraStockMovement"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "ExtraStockMovement delete admin"
ON public."ExtraStockMovement"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

CREATE POLICY "BarberPayout select admin or owner"
ON public."BarberPayout"
FOR SELECT
TO authenticated
USING (public.app_is_admin("shopId") OR "barberId" = public.app_user_id());

CREATE POLICY "BarberPayout insert admin"
ON public."BarberPayout"
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "BarberPayout update admin"
ON public."BarberPayout"
FOR UPDATE
TO authenticated
USING (public.app_is_admin("shopId"))
WITH CHECK (public.app_is_admin("shopId"));

CREATE POLICY "BarberPayout delete admin"
ON public."BarberPayout"
FOR DELETE
TO authenticated
USING (public.app_is_admin("shopId"));

COMMIT;
