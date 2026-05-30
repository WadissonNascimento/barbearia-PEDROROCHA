CREATE OR REPLACE FUNCTION "setAppointmentPublicId"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."publicId" IS NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(NEW."shopId"),
      hashtext('appointment_public_id')
    );

    SELECT COALESCE(MAX("publicId"), 0) + 1
    INTO NEW."publicId"
    FROM "Appointment"
    WHERE "shopId" = NEW."shopId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "appointmentPublicIdBeforeInsert" ON "Appointment";

CREATE TRIGGER "appointmentPublicIdBeforeInsert"
BEFORE INSERT ON "Appointment"
FOR EACH ROW
EXECUTE FUNCTION "setAppointmentPublicId"();
