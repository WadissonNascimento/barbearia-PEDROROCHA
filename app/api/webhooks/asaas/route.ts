import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  processAsaasVipWebhook,
  type AsaasWebhookPayload,
} from "@/lib/asaasVipWebhook";

export const runtime = "nodejs";

function hasValidWebhookToken(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();

  if (!expected) {
    return false;
  }

  return request.headers.get("asaas-access-token") === expected;
}

export async function POST(request: Request) {
  if (!hasValidWebhookToken(request)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as AsaasWebhookPayload | null;

  if (!payload) {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }

  try {
    const result = await processAsaasVipWebhook(payload);
    if (!result.ignored) {
      revalidatePath("/admin/vip");
      revalidatePath("/planos");
      revalidatePath("/agendar");
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[asaas-webhook] Falha ao processar evento VIP", error);
    return NextResponse.json(
      { message: "Não foi possível processar o evento." },
      { status: 500 }
    );
  }
}
