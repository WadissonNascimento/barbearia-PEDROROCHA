"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { SYSTEM_BILLING_OWNER_EMAIL } from "@/lib/systemBilling";

export type SystemBillingActionState = {
  ok: boolean;
  message: string | null;
};

export async function markSystemBillingPaymentPaidAction(
  _previousState: SystemBillingActionState,
  formData: FormData
): Promise<SystemBillingActionState> {
  const { session, shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });
  const paymentId = String(formData.get("paymentId") || "").trim();
  const userEmail = session.user.email?.trim().toLowerCase();

  if (!paymentId) {
    return {
      ok: false,
      message: "Pagamento não encontrado.",
    };
  }

  if (userEmail !== SYSTEM_BILLING_OWNER_EMAIL) {
    return {
      ok: false,
      message:
        "Somente a conta responsável pela plataforma pode confirmar este pagamento.",
    };
  }

  const updated = await prisma.systemBillingPayment.updateMany({
    where: {
      id: paymentId,
      shopId,
      status: {
        not: "PAID",
      },
    },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paidByUserId: session.user.id,
      notes: "Mensalidade confirmada pela conta responsável pela plataforma.",
    },
  });

  if (updated.count === 0) {
    return {
      ok: false,
      message: "Este pagamento já foi confirmado ou não pertence a esta barbearia.",
    };
  }

  revalidatePath("/admin");

  return {
    ok: true,
    message: "Pagamento confirmado. O aviso foi removido deste ciclo.",
  };
}
