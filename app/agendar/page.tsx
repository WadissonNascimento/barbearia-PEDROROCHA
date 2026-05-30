import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/lib/money";
import { normalizeAppointmentStatus } from "@/lib/appointmentStatus";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import { logSecurityEvent } from "@/lib/security";
import { getCurrentShop } from "@/lib/shop";
import { CUSTOMER_ROLES, requireTenantSession } from "@/lib/tenantSession";
import {
  formatScheduleTime,
  getScheduleDateValue,
  isScheduleDateTimePast,
} from "@/lib/scheduleTime";
import BookingClient from "./BookingClient";

export async function generateMetadata() {
  const shop = await getCurrentShop();
  const brandName = shop.name || "Barbearia";

  return {
    title: "Agendar horario",
    description: `Escolha barbeiro, servico, data e horario para agendar na ${brandName}.`,
  };
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextDays(count: number) {
  const days: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  for (let index = 0; index < count; index += 1) {
    const current = new Date(base);
    current.setDate(base.getDate() + index);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");

    days.push(`${year}-${month}-${day}`);
  }

  return days;
}

type AgendarPageSearchParams = {
  remarcar?: string | string[];
};

function getSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function AgendarPage({
  searchParams,
}: {
  searchParams?: Promise<AgendarPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const { session, shop } = await requireTenantSession({
    roles: CUSTOMER_ROLES,
  });

  const [barbers, services, initialExtras] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "BARBER",
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        image: true,
        phone: true,
      },
    }),
    prisma.service.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        barberId: true,
        name: true,
        price: true,
        duration: true,
        bufferAfter: true,
      },
    }),
    prisma.extraProduct.findMany({
      where: {
        isActive: true,
        stock: {
          gt: 0,
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        stock: true,
        imageUrl: true,
      },
    }),
  ]);
  let extras = initialExtras;
  const rescheduleAppointmentId = getSearchParam(resolvedSearchParams.remarcar).trim();
  let rescheduleAppointment: {
    id: string;
    appointmentCode: string;
    barberId: string;
    serviceIds: string[];
    date: string;
    time: string;
    extras: Array<{ extraProductId: string; quantity: number }>;
  } | null = null;

  if (rescheduleAppointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: {
        id: rescheduleAppointmentId,
      },
      include: {
        services: {
          orderBy: {
            orderIndex: "asc",
          },
          select: {
            serviceId: true,
          },
        },
        items: {
          select: {
            extraProductId: true,
            quantity: true,
          },
        },
      },
    });

    if (!appointment || appointment.customerId !== session.user.id) {
      logSecurityEvent("idor_blocked", {
        route: "/agendar",
        userId: session.user.id,
        appointmentId: rescheduleAppointmentId,
      });
      redirect("/customer/agendamentos");
    }

    if (appointment.isManualFitIn) {
      redirect("/customer/agendamentos");
    }

    if (
      ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(
        normalizeAppointmentStatus(appointment.status)
      ) ||
      isScheduleDateTimePast(appointment.date)
    ) {
      redirect("/customer/agendamentos");
    }

    const activeBarberId = barbers.some((barber) => barber.id === appointment.barberId)
      ? appointment.barberId
      : barbers[0]?.id || "";

    rescheduleAppointment = {
      id: appointment.id,
      appointmentCode: formatAppointmentPublicId(appointment.publicId),
      barberId: activeBarberId,
      serviceIds: appointment.services.map((service) => service.serviceId),
      date: getScheduleDateValue(appointment.date),
      time: formatScheduleTime(appointment.date),
      extras: appointment.items.map((item) => ({
        extraProductId: item.extraProductId,
        quantity: item.quantity,
      })),
    };

    const selectedExtraIds = rescheduleAppointment.extras.map((item) => item.extraProductId);

    if (selectedExtraIds.length > 0) {
      extras = await prisma.extraProduct.findMany({
        where: {
          isActive: true,
          OR: [
            {
              stock: {
                gt: 0,
              },
            },
            {
              id: {
                in: selectedExtraIds,
              },
            },
          ],
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          price: true,
          stock: true,
          imageUrl: true,
        },
      });
    }
  }
  const rescheduleExtraQuantityById = new Map(
    (rescheduleAppointment?.extras || []).map((item) => [
      item.extraProductId,
      item.quantity,
    ])
  );

  return (
    <BookingClient
      barbers={barbers}
      services={services.map((service) => ({
        ...service,
        price: toMoneyNumber(service.price),
      }))}
      extras={extras.map((extra) => ({
        ...extra,
        price: toMoneyNumber(extra.price),
        stock: extra.stock + (rescheduleExtraQuantityById.get(extra.id) || 0),
      }))}
      initialDate={getTodayString()}
      nextDays={getNextDays(12)}
      whatsappNumber={shop.whatsappNumber || ""}
      rescheduleAppointment={rescheduleAppointment}
    />
  );
}
