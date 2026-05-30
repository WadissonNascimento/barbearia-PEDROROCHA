import "server-only";

import type { Prisma } from "@prisma/client";
import { basePrisma } from "@/lib/prisma-core";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
} from "@/lib/appointmentServices";
import {
  formatScheduleDate,
  formatScheduleTime,
  getCurrentScheduleMinutes,
  getCurrentScheduleDateValue,
  getScheduleDateValue,
  getScheduleDayOfWeek,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import { sendPushNotificationToUser } from "@/lib/webPush";

export type CreateAppNotificationInput = {
  shopId: string;
  recipientUserId: string;
  type: string;
  eventKey: string;
  eyebrow?: string | null;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  createdAt?: Date;
};

export async function createAppNotification({
  shopId,
  recipientUserId,
  type,
  eventKey,
  eyebrow,
  title,
  body,
  actionUrl,
  metadata,
  createdAt,
}: CreateAppNotificationInput) {
  if (!shopId || !recipientUserId || !type || !eventKey || !title || !body) {
    return null;
  }

  const normalizedMetadata = metadata ? removeUndefinedJsonValues(metadata) : undefined;

  const existingNotification = await basePrisma.appNotification.findUnique({
    where: {
      shopId_recipientUserId_eventKey: {
        shopId,
        recipientUserId,
        eventKey,
      },
    },
    select: {
      id: true,
    },
  });

  const notification = await basePrisma.appNotification.upsert({
    where: {
      shopId_recipientUserId_eventKey: {
        shopId,
        recipientUserId,
        eventKey,
      },
    },
    create: {
      shopId,
      recipientUserId,
      type,
      eventKey,
      eyebrow: eyebrow || null,
      title,
      body,
      actionUrl: actionUrl || null,
      metadata: normalizedMetadata,
      ...(createdAt ? { createdAt } : {}),
    },
    update: {
      type,
      eyebrow: eyebrow || null,
      title,
      body,
      actionUrl: actionUrl || null,
      metadata: normalizedMetadata,
    },
  });

  if (!existingNotification) {
    try {
      await sendPushNotificationToUser({
        shopId,
        userId: recipientUserId,
        notificationId: notification.id,
        title,
        body,
        url: actionUrl || "/",
        type,
      });
    } catch (error) {
      console.warn(
        `[push] Falha ao preparar notificacao ${notification.id}: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`
      );
    }
  }

  return notification;
}

function removeUndefinedJsonValues(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is Prisma.InputJsonValue => item !== undefined)
      .map((item) => removeUndefinedJsonValues(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [
          key,
          removeUndefinedJsonValues(item as Prisma.InputJsonValue),
        ])
    ) as Prisma.InputJsonObject;
  }

  return value;
}

export async function createAppNotificationSafely(input: CreateAppNotificationInput) {
  try {
    return await createAppNotification(input);
  } catch (error) {
    console.warn(
      `[notification] Falha ao criar notificacao ${input.eventKey}: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`
    );
    return null;
  }
}

async function getShopAdminRecipients(shopId: string) {
  return basePrisma.user.findMany({
    where: {
      shopId,
      role: "ADMIN",
      isActive: true,
    },
    select: {
      id: true,
    },
  });
}

async function createNotificationForShopAdmins({
  shopId,
  type,
  eventKey,
  eyebrow,
  title,
  body,
  actionUrl,
  metadata,
}: Omit<CreateAppNotificationInput, "recipientUserId">) {
  const admins = await getShopAdminRecipients(shopId);

  await Promise.all(
    admins.map((admin) =>
      createAppNotificationSafely({
        shopId,
        recipientUserId: admin.id,
        type,
        eventKey: `${eventKey}:admin:${admin.id}`,
        eyebrow,
        title,
        body,
        actionUrl,
        metadata,
      })
    )
  );

  return admins.length;
}

async function loadAppointmentForAdminNotification(appointmentId: string) {
  return basePrisma.appointment.findUnique({
    where: {
      id: appointmentId,
    },
    select: {
      id: true,
      publicId: true,
      shopId: true,
      date: true,
      status: true,
      notes: true,
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },
      barber: {
        select: {
          id: true,
          name: true,
        },
      },
      services: {
        orderBy: {
          orderIndex: "asc",
        },
        select: {
          nameSnapshot: true,
          orderIndex: true,
          priceSnapshot: true,
        },
      },
      items: {
        select: {
          productNameSnapshot: true,
          quantity: true,
          subtotal: true,
          isDelivered: true,
        },
      },
    },
  });
}

function getAdminAppointmentMetadata(
  appointment: NonNullable<Awaited<ReturnType<typeof loadAppointmentForAdminNotification>>>,
  extra?: Record<string, string | number | null>
) {
  return {
    appointmentId: appointment.id,
    appointmentCode: formatAppointmentPublicId(appointment.publicId),
    barberName: appointment.barber.name || "Barbeiro",
    customerName: appointment.customer.name || "Cliente",
    phone: appointment.customer.phone || null,
    serviceName:
      getAppointmentDisplayName(appointment.services) || "Servico agendado",
    date: formatScheduleDate(appointment.date),
    time: formatScheduleTime(appointment.date),
    status: appointment.status,
    total: getAppointmentGrandTotal(appointment.services, appointment.items),
    ...extra,
  };
}

function getCancellationReason(notes: string | null, explicitReason?: string | null) {
  if (explicitReason?.trim()) {
    return explicitReason.trim();
  }

  const parts = notes?.split("|").map((part) => part.trim()).filter(Boolean) || [];

  return parts.at(-1) || "Motivo nao informado.";
}

export async function notifyAdminsAppointmentCancelled(
  appointmentId: string,
  cancellationReason?: string | null
) {
  const appointment = await loadAppointmentForAdminNotification(appointmentId);

  if (!appointment) {
    return 0;
  }

  const reason = getCancellationReason(appointment.notes, cancellationReason);
  const serviceName =
    getAppointmentDisplayName(appointment.services) || "Servico agendado";

  return createNotificationForShopAdmins({
    shopId: appointment.shopId,
    type: "admin.appointment_cancelled",
    eventKey: `admin:appointment_cancelled:${appointment.id}:${appointment.status}`,
    eyebrow: "Atendimento",
    title: "Agendamento cancelado",
    body: `${appointment.customer.name || "Cliente"} teve o agendamento de ${serviceName} cancelado.`,
    actionUrl: `/admin/agenda?dateFrom=${getScheduleDateValue(appointment.date)}&dateTo=${getScheduleDateValue(appointment.date)}&barberId=${appointment.barber.id}`,
    metadata: getAdminAppointmentMetadata(appointment, {
      reason,
    }),
  });
}

export async function notifyAdminsAppointmentNoShow(appointmentId: string) {
  const appointment = await loadAppointmentForAdminNotification(appointmentId);

  if (!appointment) {
    return 0;
  }

  const serviceName =
    getAppointmentDisplayName(appointment.services) || "Servico agendado";

  return createNotificationForShopAdmins({
    shopId: appointment.shopId,
    type: "admin.appointment_no_show",
    eventKey: `admin:appointment_no_show:${appointment.id}:${appointment.status}`,
    eyebrow: "Atendimento",
    title: "Cliente marcado como falta",
    body: "Um agendamento foi marcado como falta.",
    actionUrl: `/admin/agenda?dateFrom=${getScheduleDateValue(appointment.date)}&dateTo=${getScheduleDateValue(appointment.date)}&barberId=${appointment.barber.id}`,
    metadata: getAdminAppointmentMetadata(appointment),
  });
}

export async function notifyAdminsLowStockExtras({
  shopId,
  threshold = 3,
}: {
  shopId: string;
  threshold?: number;
}) {
  const extras = await basePrisma.extraProduct.findMany({
    where: {
      shopId,
      isActive: true,
      stock: {
        lte: threshold,
      },
    },
    select: {
      id: true,
      name: true,
      stock: true,
    },
    orderBy: {
      stock: "asc",
    },
    take: 10,
  });

  if (extras.length === 0) {
    return 0;
  }

  const title =
    extras.length === 1
      ? `${extras[0].name} esta com estoque baixo`
      : `${extras.length} extras com estoque baixo`;

  return createNotificationForShopAdmins({
    shopId,
    type: "admin.low_stock_extras",
    eventKey: `admin:low_stock_extras:${shopId}:${getCurrentScheduleDateValue()}`,
    eyebrow: "Estoque",
    title,
    body: "Confira os extras antes que faltem para os atendimentos.",
    actionUrl: "/admin/extras",
    metadata: {
      threshold,
      extras: extras.map((extra) => ({
        id: extra.id,
        name: extra.name,
        stock: extra.stock,
      })),
    },
  });
}

export async function notifyBarberOpenAppointmentsAtShiftEnd({
  barberId,
  date = getCurrentScheduleDateValue(),
}: {
  barberId: string;
  date?: string;
}) {
  const range = getScheduleDayRange(date);

  if (!range) {
    return null;
  }

  const barber = await basePrisma.user.findFirst({
    where: {
      id: barberId,
      role: "BARBER",
      isActive: true,
    },
    select: {
      id: true,
      shopId: true,
    },
  });

  if (!barber) {
    return null;
  }

  const openAppointments = await basePrisma.appointment.findMany({
    where: {
      shopId: barber.shopId,
      barberId: barber.id,
      date: {
        gte: range.start,
        lte: range.end,
      },
      status: {
        notIn: ["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"],
      },
    },
    select: {
      id: true,
      publicId: true,
      date: true,
      status: true,
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },
      services: {
        orderBy: {
          orderIndex: "asc",
        },
        select: {
          nameSnapshot: true,
          orderIndex: true,
        },
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  if (openAppointments.length === 0) {
    return null;
  }

  const label =
    openAppointments.length === 1
      ? "1 atendimento em aberto, confira"
      : `${openAppointments.length} atendimentos em aberto, confira`;

  const barberName = await basePrisma.user.findUnique({
    where: {
      id: barber.id,
    },
    select: {
      name: true,
    },
  });

  const metadata = {
    openAppointments: openAppointments.length,
    barberId: barber.id,
    date,
    appointments: openAppointments.map((appointment) => ({
      id: appointment.id,
      appointmentCode: formatAppointmentPublicId(appointment.publicId),
      barberName: barberName?.name || "Barbeiro",
      customerName: appointment.customer.name || "Cliente",
      phone: appointment.customer.phone || null,
      serviceName:
        getAppointmentDisplayName(appointment.services) || "Servico agendado",
      date: formatScheduleDate(appointment.date),
      time: formatScheduleTime(appointment.date),
      status: appointment.status,
    })),
  };
  const notification = await createAppNotificationSafely({
    shopId: barber.shopId,
    recipientUserId: barber.id,
    type: "barber.open_appointments_shift_end",
    eventKey: `barber:open_appointments_shift_end:${barber.id}:${date}`,
    eyebrow: "Fim do turno",
    title: label,
    body: "Ainda existem atendimentos do dia sem conclusao.",
    actionUrl: `/barber/agenda?date=${date}`,
    metadata,
  });

  await createNotificationForShopAdmins({
    shopId: barber.shopId,
    type: "admin.barber_open_appointments_shift_end",
    eventKey: `admin:barber_open_appointments_shift_end:${barber.id}:${date}`,
    eyebrow: "Fim do turno",
    title: `${barberName?.name || "Barbeiro"} tem ${label}`,
    body: "Ainda existem atendimentos do dia sem conclusao.",
    actionUrl: `/admin/agenda?dateFrom=${date}&dateTo=${date}&barberId=${barber.id}`,
    metadata,
  });

  return notification;
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export async function sendOpenAppointmentShiftEndNotifications({
  now = new Date(),
  take = 100,
}: {
  now?: Date;
  take?: number;
} = {}) {
  const date = getCurrentScheduleDateValue(now);
  const weekDay = getScheduleDayOfWeek(date);
  const currentMinutes = getCurrentScheduleMinutes(now);

  if (weekDay === null) {
    return {
      checked: 0,
      created: 0,
      skipped: 0,
    };
  }

  const barbers = await basePrisma.user.findMany({
    where: {
      role: "BARBER",
      isActive: true,
      barberAvailabilities: {
        some: {
          weekDay,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      barberAvailabilities: {
        where: {
          weekDay,
          isActive: true,
        },
        select: {
          endTime: true,
        },
        take: 1,
      },
    },
    take,
  });

  let created = 0;
  let skipped = 0;

  for (const barber of barbers) {
    const endTime = barber.barberAvailabilities[0]?.endTime;

    if (!endTime || timeToMinutes(endTime) > currentMinutes) {
      skipped += 1;
      continue;
    }

    const notification = await notifyBarberOpenAppointmentsAtShiftEnd({
      barberId: barber.id,
      date,
    });

    if (notification) {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    checked: barbers.length,
    created,
    skipped,
  };
}

export async function sendAdminDailySummaryNotifications({
  date = getCurrentScheduleDateValue(),
}: {
  date?: string;
} = {}) {
  const range = getScheduleDayRange(date);

  if (!range) {
    return {
      shops: 0,
      created: 0,
    };
  }

  const shops = await basePrisma.shop.findMany({
    where: {
      users: {
        some: {
          role: "ADMIN",
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
  let created = 0;

  for (const shop of shops) {
    const appointments = await basePrisma.appointment.findMany({
      where: {
        shopId: shop.id,
        date: {
          gte: range.start,
          lte: range.end,
        },
      },
      select: {
        status: true,
        services: {
          select: {
            priceSnapshot: true,
          },
        },
        items: {
          select: {
            subtotal: true,
            isDelivered: true,
          },
        },
      },
    });

    const completed = appointments.filter((appointment) =>
      ["COMPLETED", "DONE"].includes(appointment.status)
    );
    const cancelled = appointments.filter((appointment) =>
      ["CANCELLED", "CANCELED"].includes(appointment.status)
    );
    const noShow = appointments.filter((appointment) => appointment.status === "NO_SHOW");
    const revenue = completed.reduce(
      (sum, appointment) =>
        sum +
        getAppointmentGrandTotal(
          appointment.services,
          appointment.items.filter((item) => item.isDelivered)
        ),
      0
    );

    const adminCount = await createNotificationForShopAdmins({
      shopId: shop.id,
      type: "admin.daily_summary",
      eventKey: `admin:daily_summary:${shop.id}:${date}`,
      eyebrow: "Resumo diario",
      title: `Resumo de ${formatScheduleDate(range.start)}`,
      body: `${completed.length} concluidos, ${cancelled.length} cancelados e ${noShow.length} faltas.`,
      actionUrl: `/admin/financeiro?dateFrom=${date}&dateTo=${date}`,
      metadata: {
        date,
        totalAppointments: appointments.length,
        completedAppointments: completed.length,
        cancelledAppointments: cancelled.length,
        noShowAppointments: noShow.length,
        revenue,
      },
    });

    created += adminCount;
  }

  return {
    shops: shops.length,
    created,
  };
}
