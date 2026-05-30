import { NextResponse } from "next/server";
import { sendOpenAppointmentShiftEndNotifications } from "@/lib/appNotifications";
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

async function handleBarberOpenAppointmentsCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logSecurityEvent("cron_secret_missing", {
      route: "/api/cron/barber-open-appointments",
    });

    return NextResponse.json(
      { message: "CRON_SECRET nao configurado." },
      { status: 503 }
    );
  }

  if (getBearerToken(request) !== cronSecret) {
    logSecurityEvent("cron_access_denied", {
      route: "/api/cron/barber-open-appointments",
    });

    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const result = await sendOpenAppointmentShiftEndNotifications();

  return NextResponse.json({
    message: "Atendimentos em aberto processados.",
    checked: result.checked,
    created: result.created,
    skipped: result.skipped,
  });
}

export async function GET(request: Request) {
  return handleBarberOpenAppointmentsCron(request);
}

export async function POST(request: Request) {
  return handleBarberOpenAppointmentsCron(request);
}
