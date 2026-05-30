"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, getTenantSession } from "@/lib/tenantSession";

export async function markCustomerNotificationReadAction(notificationId: string) {
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });
  const id = notificationId.trim();

  if (!id || !tenantSession) {
    return;
  }

  await prisma.appNotification.updateMany({
    where: {
      id,
      shopId: tenantSession.shopId,
      recipientUserId: tenantSession.user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath("/customer/agendamentos");
  revalidatePath("/customer/notificacoes");
}
