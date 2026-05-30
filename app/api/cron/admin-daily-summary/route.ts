import { NextResponse } from "next/server";
import { sendAdminDailySummaryNotifications } from "@/lib/appNotifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || undefined;
  const result = await sendAdminDailySummaryNotifications({ date });

  return NextResponse.json(result);
}

