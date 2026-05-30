import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import {
  AppointmentMutationError,
  createCustomerAppointment,
  rescheduleCustomerAppointment,
} from "@/lib/appointmentMutations";
import {
  notifyCustomerAppointmentConfirmed,
  notifyCustomerAppointmentRescheduled,
} from "@/lib/appointmentEmails";
import {
  notifyBarberAppointmentRescheduled,
  notifyBarberNewAppointment,
} from "@/lib/barberEmails";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import { prisma } from "@/lib/prisma";
import {
  enforceRateLimit,
  logSecurityEvent,
  rateLimitResponse,
  readJsonWithLimit,
} from "@/lib/security";
import { CUSTOMER_ROLES, getTenantSession } from "@/lib/tenantSession";

function revalidateBookingPaths(customerId: string) {
  revalidatePath("/customer/agendamentos");
  revalidatePath("/meu-perfil");
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");
  revalidatePath("/barber/clientes");
  revalidatePath(`/barber/clientes/${customerId}`);
  revalidatePath("/admin/agenda");
  revalidatePath("/agendar");
}

async function runBookingNotifications({
  appointmentId,
  previousDate,
  nextDate,
}: {
  appointmentId: string;
  previousDate: Date | null;
  nextDate: Date;
}) {
  const jobs = previousDate
    ? [
        notifyCustomerAppointmentRescheduled(appointmentId, previousDate, nextDate),
        notifyBarberAppointmentRescheduled({
          appointmentId,
          previousDate,
          nextDate,
        }),
      ]
    : [
        notifyCustomerAppointmentConfirmed(appointmentId),
        notifyBarberNewAppointment(appointmentId),
      ];

  const results = await Promise.allSettled(jobs);

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn(
        `[email] Falha em notificacao pos-agendamento ${appointmentId}: ${
          result.reason instanceof Error ? result.reason.message : "erro desconhecido"
        }`
      );
    }
  });
}

export async function POST(request: Request) {
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });

  if (!tenantSession) {
    logSecurityEvent("access_denied", {
      route: "/api/booking/appointments",
      role: "anonymous",
    });
    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }
  const { session } = tenantSession;

  const customer = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      phone: true,
    },
  });

  if (!customer?.phone) {
    return NextResponse.json(
      { message: "Informe seu telefone para continuar o agendamento." },
      { status: 400 }
    );
  }

  const rateLimit = await enforceRateLimit({
    scope: "booking:create",
    identifier: session.user.id,
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse("Muitos agendamentos em pouco tempo. Tente novamente mais tarde.");
  }

  try {
    const body = (await readJsonWithLimit(request, 8 * 1024)) as {
      barberId?: string;
      serviceIds?: string[];
      extras?: Array<{ extraProductId?: string; quantity?: number }>;
      date?: string;
      time?: string;
      notes?: string;
      rescheduleAppointmentId?: string;
    };

    const barberId = String(body.barberId || "").trim();
    const serviceIds = Array.isArray(body.serviceIds)
      ? body.serviceIds.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const extras = Array.isArray(body.extras)
      ? body.extras
          .map((extra) => ({
            extraProductId: String(extra?.extraProductId || "").trim(),
            quantity: Number(extra?.quantity || 0),
          }))
          .filter(
            (extra) =>
              extra.extraProductId &&
              Number.isInteger(extra.quantity) &&
              extra.quantity > 0
          )
      : [];
    const date = String(body.date || "").trim();
    const time = String(body.time || "").trim();
    const notes = String(body.notes || "").trim().slice(0, 50);
    const rescheduleAppointmentId = String(body.rescheduleAppointmentId || "").trim();

    const result = rescheduleAppointmentId
      ? await rescheduleCustomerAppointment({
          appointmentId: rescheduleAppointmentId,
          customerId: session.user.id,
          barberId,
          serviceIds,
          extras,
          date,
          time,
          notes,
        })
      : {
          appointment: await createCustomerAppointment({
            customerId: session.user.id,
            barberId,
            serviceIds,
            extras,
            date,
            time,
            notes,
          }),
          previousDate: null,
        };
    const appointment = result.appointment;

    after(async () => {
      revalidateBookingPaths(session.user.id);
      await runBookingNotifications({
        appointmentId: appointment.id,
        previousDate: result.previousDate,
        nextDate: appointment.date,
      });
    });

    return NextResponse.json({
      message: result.previousDate
        ? "Agendamento remarcado com sucesso."
        : "Agendamento realizado com sucesso.",
      appointmentCode: formatAppointmentPublicId(appointment.publicId),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ message: "Requisicao muito grande." }, { status: 413 });
    }

    if (error instanceof AppointmentMutationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json(
      { message: "Nao foi possivel concluir o agendamento." },
      { status: 500 }
    );
  }
}
