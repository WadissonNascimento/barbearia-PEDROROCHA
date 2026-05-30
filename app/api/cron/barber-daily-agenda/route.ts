import { NextResponse } from "next/server";
import { sendDailyBarberAgendaEmails } from "@/lib/barberEmails";
import { logSecurityEvent } from "@/lib/security";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() === "bearer" && token) {
    return token.trim();
  }

  return request.headers.get("x-cron-secret")?.trim() || "";
}

async function handleBarberDailyAgendaCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logSecurityEvent("cron_secret_missing", {
      route: "/api/cron/barber-daily-agenda",
    });

    return NextResponse.json(
      { message: "CRON_SECRET nao configurado." },
      { status: 503 }
    );
  }

  if (getBearerToken(request) !== cronSecret) {
    logSecurityEvent("cron_access_denied", {
      route: "/api/cron/barber-daily-agenda",
    });

    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || undefined;
  const includeEmptyAgenda = url.searchParams.get("includeEmpty") === "1";
  const result = await sendDailyBarberAgendaEmails({
    date,
    includeEmptyAgenda,
  });

  return NextResponse.json({
    message: "Agenda diaria dos barbeiros processada.",
    checked: result.checked,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
  });
}

export async function GET(request: Request) {
  return handleBarberDailyAgendaCron(request);
}

export async function POST(request: Request) {
  return handleBarberDailyAgendaCron(request);
}
