ALTER TABLE public."Appointment"
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Appointment_paymentMethod_check'
  ) THEN
    ALTER TABLE public."Appointment"
      ADD CONSTRAINT "Appointment_paymentMethod_check"
      CHECK (
        "paymentMethod" IS NULL
        OR "paymentMethod" IN ('PIX', 'CASH', 'CARD')
      );
  END IF;
END $$;
