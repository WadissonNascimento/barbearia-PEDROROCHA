import "server-only";

import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import { getAppointmentItemsLabel } from "@/lib/appointmentItems";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
  getAppointmentServiceMetaLine,
} from "@/lib/appointmentServices";
import { createAppNotificationSafely } from "@/lib/appNotifications";
import { getShopAppUrl } from "@/lib/appUrl";
import {
  sendAppointmentCancelledEmail,
  sendAppointmentCompletedEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
  sendAppointmentRescheduledEmail,
  type AppointmentCustomerEmailPayload,
} from "@/lib/mail";
import { basePrisma } from "@/lib/prisma-core";
import {
  formatScheduleDate,
  formatScheduleTime,
  getCurrentScheduleDate,
  getCurrentScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";
import type { MoneyValue } from "@/lib/money";

const ACTIVE_REMINDER_STATUSES = ["PENDING", "CONFIRMED"];
const REMINDER_LOOKAHEAD_MINUTES = 30;
const REMINDER_WINDOW_MINUTES = 10;
const TRANSPARENT_LOGO_DATA_URI = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

type EmailAppointment = {
  id: string;
  shopId: string;
  publicId: number;
  date: Date;
  shop: {
    name: string;
    primaryDomain: string | null;
    logoPath: string | null;
    brandColor: string | null;
    addressLine: string | null;
    whatsappNumber: string | null;
  };
  customer: {
    id: string;
    name: string | null;
    email: string | null;
  };
  barber: {
    name: string | null;
  };
  services: Array<{
    nameSnapshot: string;
    priceSnapshot: MoneyValue;
    durationSnapshot: number;
    orderIndex: number;
  }>;
  items: Array<{
    productNameSnapshot: string;
    quantity: number;
    subtotal: MoneyValue;
  }>;
};

const appointmentEmailInclude = {
  shop: {
    select: {
      name: true,
      primaryDomain: true,
      logoPath: true,
      brandColor: true,
      addressLine: true,
      whatsappNumber: true,
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  barber: {
    select: {
      name: true,
    },
  },
  services: {
    orderBy: {
      orderIndex: "asc" as const,
    },
    select: {
      nameSnapshot: true,
      priceSnapshot: true,
      durationSnapshot: true,
      orderIndex: true,
    },
  },
  items: {
    select: {
      productNameSnapshot: true,
      quantity: true,
      subtotal: true,
    },
  },
};

function normalizeName(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function getCustomerAppointmentsUrl(shop: { primaryDomain?: string | null }) {
  return `${getShopAppUrl(shop)}/customer/agendamentos`;
}

function formatDateTimeLabel(date: Date) {
  return `${formatScheduleDate(date, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} as ${formatScheduleTime(date)}`;
}

function resolveEmailLogoUrl(
  logoPath: string | null | undefined,
  shop: { primaryDomain?: string | null }
) {
  const value = logoPath?.trim();

  if (!value) {
    return TRANSPARENT_LOGO_DATA_URI;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${getShopAppUrl(shop)}${value.startsWith("/") ? value : `/${value}`}`;
}

function buildAppointmentEmailPayload(
  appointment: EmailAppointment,
  cancellationReason?: string | null
): AppointmentCustomerEmailPayload | null {
  const to = appointment.customer.email?.trim();

  if (!to) {
    return null;
  }

  const serviceName =
    getAppointmentDisplayName(appointment.services) || "Servico agendado";
  const extrasLabel =
    appointment.items.length > 0
      ? getAppointmentItemsLabel(appointment.items)
      : undefined;

  return {
    to,
    shopId: appointment.shopId,
    recipientUserId: appointment.customer.id,
    eventKey: `customer:appointment:${appointment.id}`,
    nomeBarbearia: appointment.shop.name,
    logoBarbearia: resolveEmailLogoUrl(appointment.shop.logoPath, appointment.shop),
    corPrimaria: appointment.shop.brandColor || undefined,
    enderecoBarbearia: appointment.shop.addressLine,
    telefoneBarbearia: appointment.shop.whatsappNumber,
    customerName: normalizeName(appointment.customer.name, "cliente"),
    appointmentCode: formatAppointmentPublicId(appointment.publicId),
    barberName: normalizeName(appointment.barber.name, "barbeiro"),
    serviceName,
    serviceMeta: getAppointmentServiceMetaLine(appointment.services),
    dateLabel: formatScheduleDate(appointment.date, {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    timeLabel: formatScheduleTime(appointment.date),
    totalLabel: formatCurrency(
      getAppointmentGrandTotal(appointment.services, appointment.items)
    ),
    extrasLabel,
    actionUrl: getCustomerAppointmentsUrl(appointment.shop),
    cancellationReason: cancellationReason?.trim() || null,
  };
}

async function loadAppointmentForEmail(appointmentId: string) {
  return basePrisma.appointment.findUnique({
    where: {
      id: appointmentId,
    },
    include: appointmentEmailInclude,
  });
}

function logAppointmentEmailFailure(
  kind: string,
  appointmentId: string,
  error: unknown
) {
  console.warn(
    `[email] Falha ao enviar ${kind} do agendamento ${appointmentId}: ${
      error instanceof Error ? error.message : "erro desconhecido"
    }`
  );
}

async function sendCustomerAppointmentEmailSafely(
  kind: string,
  appointmentId: string,
  send: (payload: AppointmentCustomerEmailPayload) => Promise<void>,
  cancellationReason?: string | null
) {
  try {
    const appointment = await loadAppointmentForEmail(appointmentId);
    const payload = appointment
      ? buildAppointmentEmailPayload(appointment, cancellationReason)
      : null;

    if (!payload) {
      return false;
    }

    if (payload.shopId && payload.recipientUserId) {
      await createAppNotificationSafely({
        shopId: payload.shopId,
        recipientUserId: payload.recipientUserId,
        type: `customer.${kind}`,
        eventKey: `customer:${kind}:${appointmentId}`,
        eyebrow: "Atendimento",
        title: getCustomerNotificationTitle(kind),
        body: getCustomerNotificationBody(kind, payload),
        actionUrl: payload.actionUrl,
        metadata: {
          appointmentId,
          appointmentCode: payload.appointmentCode,
          barberName: payload.barberName,
          serviceName: payload.serviceName,
          date: payload.dateLabel,
          time: payload.timeLabel,
          status: getCustomerNotificationStatus(kind),
          reason: payload.cancellationReason,
        },
      });
    }
    await send(payload);
    return true;
  } catch (error) {
    logAppointmentEmailFailure(kind, appointmentId, error);
    return false;
  }
}

function getCustomerNotificationTitle(kind: string) {
  switch (kind) {
    case "confirmacao":
      return "Agendamento confirmado";
    case "conclusao":
      return "Atendimento concluido";
    case "cancelamento":
      return "Agendamento cancelado";
    case "reagendamento":
      return "Agendamento reagendado";
    case "lembrete":
      return "Seu horario esta chegando";
    default:
      return "Atualizacao do atendimento";
  }
}

function getCustomerNotificationBody(
  kind: string,
  payload: AppointmentCustomerEmailPayload
) {
  switch (kind) {
    case "confirmacao":
      return `${payload.serviceName} com ${payload.barberName} foi confirmado para ${payload.timeLabel}.`;
    case "conclusao":
      return `Seu atendimento de ${payload.serviceName} foi concluido. Avalie sua experiencia.`;
    case "cancelamento":
      return `Seu agendamento de ${payload.serviceName} foi cancelado.`;
    case "reagendamento":
      return `Seu agendamento de ${payload.serviceName} foi reagendado.`;
    case "lembrete":
      return `Lembrete: ${payload.serviceName} com ${payload.barberName} as ${payload.timeLabel}.`;
    default:
      return `Houve uma atualizacao no seu atendimento de ${payload.serviceName}.`;
  }
}

function getCustomerNotificationStatus(kind: string) {
  switch (kind) {
    case "cancelamento":
      return "CANCELLED";
    case "conclusao":
      return "COMPLETED";
    case "lembrete":
      return "LEMBRETE";
    default:
      return "CONFIRMED";
  }
}

export async function notifyCustomerAppointmentConfirmed(appointmentId: string) {
  return sendCustomerAppointmentEmailSafely(
    "confirmacao",
    appointmentId,
    sendAppointmentConfirmationEmail
  );
}

export async function notifyCustomerAppointmentCompleted(appointmentId: string) {
  return sendCustomerAppointmentEmailSafely(
    "conclusao",
    appointmentId,
    sendAppointmentCompletedEmail
  );
}

export async function notifyCustomerAppointmentCancelled(
  appointmentId: string,
  cancellationReason?: string | null
) {
  return sendCustomerAppointmentEmailSafely(
    "cancelamento",
    appointmentId,
    sendAppointmentCancelledEmail,
    cancellationReason
  );
}

export async function notifyCustomerAppointmentRescheduled(
  appointmentId: string,
  previousDate: Date,
  nextDate?: Date
) {
  return sendCustomerAppointmentEmailSafely("reagendamento", appointmentId, (payload) =>
    sendAppointmentRescheduledEmail({
      ...payload,
      eventKey: `customer:appointment_rescheduled:${appointmentId}:${previousDate.toISOString()}`,
      previousDateTimeLabel: formatDateTimeLabel(previousDate),
      nextDateTimeLabel: nextDate
        ? formatDateTimeLabel(nextDate)
        : `${payload.dateLabel} as ${payload.timeLabel}`,
    })
  );
}

export async function sendDueAppointmentReminderEmails({
  now = new Date(),
  take = 50,
}: {
  now?: Date;
  take?: number;
} = {}) {
  const currentScheduleDate = getCurrentScheduleDate(now);
  const windowStart = new Date(
    currentScheduleDate.getTime() +
      (REMINDER_LOOKAHEAD_MINUTES - REMINDER_WINDOW_MINUTES / 2) * 60 * 1000
  );
  const windowEnd = new Date(
    currentScheduleDate.getTime() +
      (REMINDER_LOOKAHEAD_MINUTES + REMINDER_WINDOW_MINUTES / 2) * 60 * 1000
  );

  const appointments = await basePrisma.appointment.findMany({
    where: {
      reminderSentAt: null,
      status: {
        in: ACTIVE_REMINDER_STATUSES,
      },
      date: {
        gte: windowStart,
        lt: windowEnd,
      },
      customer: {
        email: {
          not: null,
        },
      },
    },
    include: appointmentEmailInclude,
    orderBy: {
      date: "asc",
    },
    take,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const appointment of appointments) {
    const payload = buildAppointmentEmailPayload(appointment);

    if (!payload) {
      skipped += 1;
      continue;
    }

    const claimed = await basePrisma.appointment.updateMany({
      where: {
        id: appointment.id,
        shopId: appointment.shopId,
        reminderSentAt: null,
        status: {
          in: ACTIVE_REMINDER_STATUSES,
        },
      },
      data: {
        reminderSentAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      skipped += 1;
      continue;
    }

    try {
      if (payload.shopId && payload.recipientUserId) {
        await createAppNotificationSafely({
          shopId: payload.shopId,
          recipientUserId: payload.recipientUserId,
          type: "customer.lembrete",
          eventKey: `customer:lembrete:${appointment.id}`,
          eyebrow: "Lembrete",
          title: getCustomerNotificationTitle("lembrete"),
          body: getCustomerNotificationBody("lembrete", payload),
          actionUrl: payload.actionUrl,
          metadata: {
            appointmentId: appointment.id,
            appointmentCode: payload.appointmentCode,
            barberName: payload.barberName,
            serviceName: payload.serviceName,
            date: payload.dateLabel,
            time: payload.timeLabel,
            status: "LEMBRETE",
          },
        });
      }
      await sendAppointmentReminderEmail(payload);
      sent += 1;
    } catch (error) {
      failed += 1;
      logAppointmentEmailFailure("lembrete", appointment.id, error);

      await basePrisma.appointment
        .updateMany({
          where: {
            id: appointment.id,
            shopId: appointment.shopId,
          },
          data: {
            reminderSentAt: null,
          },
        })
        .catch((resetError) => {
          logAppointmentEmailFailure("reset do lembrete", appointment.id, resetError);
        });
    }
  }

  return {
    checked: appointments.length,
    sent,
    failed,
    skipped,
    windowStart,
    windowEnd,
  };
}

export async function sendCustomerAppointmentDayReminderNotifications({
  now = new Date(),
  take = 200,
}: {
  now?: Date;
  take?: number;
} = {}) {
  const dateValue = getCurrentScheduleDateValue(now);
  const range = getScheduleDayRange(dateValue);

  if (!range) {
    return {
      checked: 0,
      created: 0,
      skipped: 0,
      date: dateValue,
    };
  }

  const appointments = await basePrisma.appointment.findMany({
    where: {
      status: {
        in: ACTIVE_REMINDER_STATUSES,
      },
      date: {
        gte: range.start,
        lte: range.end,
      },
      customer: {
        email: {
          not: null,
        },
      },
    },
    include: appointmentEmailInclude,
    orderBy: {
      date: "asc",
    },
    take,
  });

  let created = 0;
  let skipped = 0;

  for (const appointment of appointments) {
    const payload = buildAppointmentEmailPayload(appointment);

    if (!payload?.shopId || !payload.recipientUserId) {
      skipped += 1;
      continue;
    }

    const notification = await createAppNotificationSafely({
      shopId: payload.shopId,
      recipientUserId: payload.recipientUserId,
      type: "customer.lembrete_dia",
      eventKey: `customer:lembrete_dia:${appointment.id}:${dateValue}`,
      eyebrow: "Lembrete",
      title: "Voce tem horario hoje",
      body: `Hoje as ${payload.timeLabel}: ${payload.serviceName} com ${payload.barberName}.`,
      actionUrl: payload.actionUrl,
      metadata: {
        appointmentId: appointment.id,
        appointmentCode: payload.appointmentCode,
        barberName: payload.barberName,
        serviceName: payload.serviceName,
        date: payload.dateLabel,
        time: payload.timeLabel,
        status: "LEMBRETE",
      },
    });

    if (notification) {
      created += 1;
    }
  }

  return {
    checked: appointments.length,
    created,
    skipped,
    date: dateValue,
  };
}
