import { redirect } from "next/navigation";
import DashboardShell from "@/components/ui/DashboardShell";
import { normalizeAppointmentStatus } from "@/lib/appointmentStatus";
import { getAppointmentTotalBarberPayout } from "@/lib/appointmentServices";
import { getBarberTipsTotal } from "@/lib/barberTips";
import { getWeekRange } from "@/lib/financials";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import BarberProfileClient from "./BarberProfileClient";

export const dynamic = "force-dynamic";

type AdminBarberRouteParams = {
  params: Promise<{ barberId: string }>;
};

function getDayRange(baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(baseDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export default async function AdminBarberProfilePage({ params }: AdminBarberRouteParams) {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });
  const { barberId } = await params;

  const barber = await prisma.user.findFirst({
    where: {
      shopId,
      id: barberId,
      role: "BARBER",
    },
    include: {
      _count: {
        select: {
          barberAppointments: true,
        },
      },
    },
  });

  if (!barber) {
    redirect("/admin/barbeiros");
  }

  const { start: todayStart, end: todayEnd } = getDayRange();
  const { start: weekStart, end: weekEnd } = getWeekRange();

  const [servicesCount, todayAppointments, weekAppointments, weekTips] = await Promise.all([
    prisma.service.count({
      where: {
        shopId,
        OR: [{ barberId: barber.id }, { barberId: null }],
      },
    }),
    prisma.appointment.findMany({
      where: {
        shopId,
        barberId: barber.id,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        items: true,
        services: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        shopId,
        barberId: barber.id,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        items: true,
        services: true,
      },
    }),
    getBarberTipsTotal({
      barberId: barber.id,
      range: {
        start: weekStart,
        end: weekEnd,
      },
    }),
  ]);

  const activeTodayAppointments = todayAppointments.filter(
    (appointment) => normalizeAppointmentStatus(appointment.status) !== "CANCELLED"
  );
  const completedWeekAppointments = weekAppointments.filter(
    (appointment) => normalizeAppointmentStatus(appointment.status) === "COMPLETED"
  );

  const weekPayout =
    completedWeekAppointments.reduce(
      (sum, appointment) =>
        sum + getAppointmentTotalBarberPayout(appointment.services, appointment.items),
      0
    ) + weekTips.tipsTotal;

  return (
    <DashboardShell>
      <BarberProfileClient
        barber={{
          id: barber.id,
          name: barber.name,
          email: barber.email,
          phone: barber.phone,
          image: barber.image,
          isActive: barber.isActive,
          appointmentsCount: barber._count.barberAppointments,
        }}
        summary={{
          todayAppointments: activeTodayAppointments.length,
          weekPayout,
          servicesCount,
        }}
      />
    </DashboardShell>
  );
}
