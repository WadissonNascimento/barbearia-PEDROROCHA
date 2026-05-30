import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("customer appointment flows send notification emails from backend actions", () => {
  assert.match(
    read("app/api/booking/appointments/route.ts"),
    /notifyCustomerAppointmentConfirmed\(appointmentId\)/
  );
  assert.match(
    read("app/api/booking/appointments/route.ts"),
    /notifyCustomerAppointmentRescheduled\(/
  );
  assert.match(
    read("app/agendar/actions.ts"),
    /notifyCustomerAppointmentConfirmed\(appointmentId\)/
  );

  const barberActions = read("app/barber/actions.ts");
  const adminAgendaActions = read("app/admin/agenda/actions.ts");

  assert.match(barberActions, /previousStatus/);
  assert.match(barberActions, /notifyCustomerAppointmentCompleted\(appointmentId\)/);
  assert.match(barberActions, /notifyCustomerAppointmentCancelled\(/);
  assert.match(
    adminAgendaActions,
    /notifyCustomerAppointmentCancelled\(appointmentId,\s*cancellationReason\)/
  );
});

test("appointment mailer exposes customer confirmation, completion, cancellation and reminder templates", () => {
  const mail = read("lib/mail.ts");
  const templates = read("lib/email/customerTemplates.ts");

  for (const exportName of [
    "sendAppointmentConfirmationEmail",
    "sendAppointmentCompletedEmail",
    "sendAppointmentCancelledEmail",
    "sendAppointmentReminderEmail",
    "sendAppointmentRescheduledEmail",
  ]) {
    assert.match(mail, new RegExp(`export async function ${exportName}`));
  }

  for (const componentName of [
    "EmailLayout",
    "EmailHeader",
    "EmailFooter",
    "AppointmentCard",
    "Button",
    "InfoRow",
    "SecurityCodeBox",
    "RatingBox",
  ]) {
    assert.match(templates, new RegExp(`function ${componentName}|export function ${componentName}`));
  }

  assert.match(templates, /renderCustomerAppointmentConfirmationEmail/);
  assert.match(templates, /renderCustomerAppointmentCompletedEmail/);
  assert.match(templates, /renderCustomerAppointmentCancelledEmail/);
  assert.match(templates, /renderCustomerAppointmentReminderEmail/);
  assert.match(templates, /renderCustomerAppointmentRescheduledEmail/);
  assert.match(templates, /renderCustomerVerificationCodeEmail/);
  assert.match(templates, /renderCustomerPasswordResetEmail/);
  assert.match(templates, /Avaliar atendimento/);
  assert.match(templates, /Motivo do cancelamento/);
  assert.match(templates, /Faltam cerca de 30 minutos/);
  assert.match(mail, /sendEmailMessage\(\{/);
});

test("appointment reminders are cron-protected and deduplicated in the database", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260509100000_add_appointment_email_reminders/migration.sql"
  );
  const reminders = read("lib/appointmentEmails.ts");
  const route = read("app/api/cron/appointment-reminders/route.ts");

  assert.match(schema, /reminderSentAt\s+DateTime\?/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "reminderSentAt"/);
  assert.match(reminders, /getCurrentScheduleDate/);
  assert.match(reminders, /reminderSentAt:\s*null/);
  assert.match(reminders, /sendAppointmentReminderEmail/);
  assert.match(reminders, /updateMany\(\{/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /authorization/);
  assert.doesNotMatch(route, /searchParams|nextUrl/);
});
