import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("barber email system has separated templates and centralized transport", () => {
  const templates = read("lib/email/barberTemplates.ts");
  const mail = read("lib/mail.ts");

  for (const renderName of [
    "renderBarberNewAppointmentEmail",
    "renderBarberAppointmentCancelledEmail",
    "renderBarberAppointmentRescheduledEmail",
    "renderBarberDailyAgendaEmail",
    "renderBarberNoShowEmail",
    "renderBarberNewReviewEmail",
  ]) {
    assert.match(templates, new RegExp(`export function ${renderName}`));
  }

  assert.match(templates, /renderLayout/);
  assert.match(templates, /renderInfoCard/);
  assert.match(templates, /renderAgendaList/);
  assert.match(mail, /export async function sendEmailMessage/);
  assert.match(mail, /maxAttempts = 2/);
  assert.match(mail, /emailDeliveryLog\.upsert/);
  assert.match(mail, /status: "SENT"/);
});

test("barber email orchestration wires existing business events", () => {
  const barberEmails = read("lib/barberEmails.ts");
  const bookingRoute = read("app/api/booking/appointments/route.ts");
  const bookingAction = read("app/agendar/actions.ts");
  const customerActions = read("app/customer/agendamentos/actions.ts");
  const barberActions = read("app/barber/actions.ts");

  for (const notifyName of [
    "notifyBarberNewAppointment",
    "notifyBarberAppointmentCancelled",
    "notifyBarberAppointmentRescheduled",
    "sendDailyBarberAgendaEmails",
    "notifyBarberNoShow",
    "notifyBarberNewReview",
  ]) {
    assert.match(barberEmails, new RegExp(`export async function ${notifyName}`));
  }

  assert.match(bookingRoute, /notifyBarberNewAppointment\(appointmentId\)/);
  assert.match(bookingRoute, /notifyBarberAppointmentRescheduled\(\{/);
  assert.match(bookingAction, /notifyBarberNewAppointment\(appointmentId\)/);
  assert.match(customerActions, /notifyBarberAppointmentCancelled\(appointmentId/);
  assert.match(customerActions, /notifyBarberNewReview\(review\.id\)/);
  assert.match(barberActions, /notifyBarberNoShow\(appointmentId\)/);
});

test("barber email logs and cron route are protected and deduplicated", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260509110000_add_email_delivery_logs/migration.sql"
  );
  const route = read("app/api/cron/barber-daily-agenda/route.ts");

  assert.match(schema, /model EmailDeliveryLog/);
  assert.match(schema, /@@unique\(\[shopId, template, eventKey, recipientEmail\]\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /EmailDeliveryLog admin select/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /sendDailyBarberAgendaEmails/);
});
