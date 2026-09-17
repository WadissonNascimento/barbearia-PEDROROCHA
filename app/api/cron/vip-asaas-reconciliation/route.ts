import { NextResponse } from "next/server";
import { reconcileVipAsaasSubscriptions } from "@/lib/vipAsaasReconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const result = await reconcileVipAsaasSubscriptions();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
