"use server";

import { revalidatePath } from "next/cache";
import { requireActiveBarber } from "@/app/barber/guard";
import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { prisma } from "@/lib/prisma";
import {
  sanitizeTextInput,
  sanitizeTextareaInput,
} from "@/lib/inputSanitization";
import { enforceRateLimit } from "@/lib/security";

const MAX_TIP_AMOUNT = 100000;

function parseTipAmount(value: FormDataEntryValue | null) {
  const rawValue = String(value || "").trim().replace(/\s+/g, "");

  if (!/^\d{1,6}([,.]\d{1,2})?$/.test(rawValue)) {
    return null;
  }

  const normalized = rawValue.replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TIP_AMOUNT) {
    return null;
  }

  return amount.toFixed(2);
}

export async function createBarberTipAction(
  _previousState: MutationResult | null,
  formData: FormData
): Promise<MutationResult> {
  const { session, barber } = await requireActiveBarber();
  const rateLimit = await enforceRateLimit({
    scope: "barber_tip:create",
    identifier: session.user.id,
    limit: 10,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError("Muitas tentativas. Aguarde um pouco e tente novamente.");
  }

  const clientName = sanitizeTextInput(String(formData.get("clientName") || ""), {
    maxLength: 120,
  });
  const note = sanitizeTextareaInput(String(formData.get("note") || ""), 500);
  const amount = parseTipAmount(formData.get("amount"));
  const shopId = barber.shopId;

  if (!clientName) {
    return mutationError("Informe o cliente que deu a caixinha.");
  }

  if (!amount) {
    return mutationError("Informe um valor positivo e valido para a caixinha.");
  }

  await prisma.barberTip.create({
    data: {
      shopId,
      barberId: barber.id,
      clientName,
      amount,
      note: note || null,
    },
  });

  revalidatePath("/barber/caixinhas");
  revalidatePath("/admin/caixinhas");

  return mutationSuccess("Caixinha anotada com sucesso.");
}
