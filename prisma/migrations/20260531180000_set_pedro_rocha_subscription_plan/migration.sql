ALTER TABLE public."Shop"
ADD COLUMN "subscriptionMonthlyPrice" DECIMAL(10, 2);

UPDATE public."Shop"
SET
  "planCode" = 'BARBEARIA_1_BARBEIRO',
  "barberLimit" = 1,
  "subscriptionMonthlyPrice" = 48.00,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'shop_pedro_rocha_barbearia';

CREATE OR REPLACE FUNCTION public.enforce_shop_barber_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  configured_limit INTEGER;
  active_barbers INTEGER;
BEGIN
  IF NEW."role" <> 'BARBER' OR NEW."isActive" IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT "barberLimit"
  INTO configured_limit
  FROM public."Shop"
  WHERE "id" = NEW."shopId";

  IF configured_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO active_barbers
  FROM public."User"
  WHERE "shopId" = NEW."shopId"
    AND "role" = 'BARBER'
    AND "isActive" IS TRUE
    AND "id" <> NEW."id";

  IF active_barbers >= configured_limit THEN
    RAISE EXCEPTION 'shop_barber_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "User_enforce_shop_barber_limit" ON public."User";
CREATE TRIGGER "User_enforce_shop_barber_limit"
BEFORE INSERT OR UPDATE OF "shopId", "role", "isActive"
ON public."User"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shop_barber_limit();
