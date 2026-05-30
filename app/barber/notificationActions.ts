"use server";

import { revalidatePath } from "next/cache";
import { requireActiveBarber } from "@/app/barber/guard";
import { prisma } from "@/lib/prisma";

export async function markBarberNotificationReadAction(notificationId: string) {
  const { barber } = await requireActiveBarber();
  const id = notificationId.trim();

  if (!id) {
    return;
  }

  await prisma.appNotification.updateMany({
    where: {
      id,
      recipientUserId: barber.id,
      shopId: barber.shopId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath("/barber");
}
