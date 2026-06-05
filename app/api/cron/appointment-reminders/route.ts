import { NextResponse } from "next/server";
import {
  sendCustomerAppointmentDayReminderNotifications,
  sendDueAppointmentReminderEmails,
} from "@/lib/appointmentEmails";
import { logSecurityEvent } from "@/lib/security";
import { sendVipPaymentDueNotifications } from "@/lib/vipBillingNotifications";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() === "bearer" && token) {
    return token.trim();
  }

  return request.headers.get("x-cron-secret")?.trim() || "";
}

async function handleAppointmentRemindersCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logSecurityEvent("cron_secret_missing", {
      route: "/api/cron/appointment-reminders",
    });

    return NextResponse.json(
      { message: "CRON_SECRET nao configurado." },
      { status: 503 }
    );
  }

  if (getBearerToken(request) !== cronSecret) {
    logSecurityEvent("cron_access_denied", {
      route: "/api/cron/appointment-reminders",
    });

    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const [dayResult, result, vipPaymentResult] = await Promise.all([
    sendCustomerAppointmentDayReminderNotifications(),
    sendDueAppointmentReminderEmails(),
    sendVipPaymentDueNotifications(),
  ]);

  return NextResponse.json({
    message: "Lembretes processados.",
    dayReminder: {
      checked: dayResult.checked,
      created: dayResult.created,
      skipped: dayResult.skipped,
      date: dayResult.date,
    },
    checked: result.checked,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    vipPayment: vipPaymentResult,
    windowStart: result.windowStart.toISOString(),
    windowEnd: result.windowEnd.toISOString(),
  });
}

export async function GET(request: Request) {
  return handleAppointmentRemindersCron(request);
}

export async function POST(request: Request) {
  return handleAppointmentRemindersCron(request);
}
