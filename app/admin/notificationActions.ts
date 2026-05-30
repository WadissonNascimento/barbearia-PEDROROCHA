"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

export async function markAdminNotificationReadAction(notificationId: string) {
  const tenantSession = await getTenantSession({
    roles: SHOP_ADMIN_ROLES,
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

  revalidatePath("/admin");
}
