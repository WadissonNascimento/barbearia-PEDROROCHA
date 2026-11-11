import { Repeat2 } from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/lib/money";
import {
  formatScheduleDate,
  formatScheduleTime,
  getCurrentScheduleDateValue,
  getScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import type {
  AdminAgendaBarber,
  AdminAgendaCustomer,
  AdminAgendaExtra,
  AdminAgendaService,
} from "@/app/admin/agenda/AdminAgendaClient";
import RecurringAppointmentCreator from "./RecurringAppointmentCreator";
import RecurringClientsClient from "./RecurringClientsClient";

export const metadata = {
  title: "Clientes recorrentes",
  description: "Gerenciamento das séries de agendamentos recorrentes.",
};

const FINAL_APPOINTMENT_STATUSES = new Set([
  "CANCELLED",
  "COMPLETED",
  "DONE",
  "NO_SHOW",
]);

function formatFrequency(value: string) {
  if (value === "BIWEEKLY") {
    return "Quinzenal";
  }

  if (value === "MONTHLY") {
    return "Mensal";
  }

  return "Semanal";
}

export default async function AdminRecurringClientsPage() {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });
  const today = getCurrentScheduleDateValue();
  const todayRange = getScheduleDayRange(today);

  const [seriesList, services, barbers, extras, customers] = await Promise.all([
    prisma.recurringAppointmentSeries.findMany({
      where: { shopId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        barber: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        appointments: {
          select: {
            id: true,
            date: true,
            status: true,
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.service.findMany({
      where: { shopId },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
        barberId: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        shopId,
        role: "BARBER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.extraProduct.findMany({
      where: {
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        shopId,
        role: "CUSTOMER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const serviceNames = new Map(services.map((service) => [service.id, service.name]));
  const items = seriesList.map((series) => {
    const upcomingAppointments = series.appointments.filter(
      (appointment) =>
        appointment.date >= (todayRange?.start || new Date()) &&
        !FINAL_APPOINTMENT_STATUSES.has(appointment.status.toUpperCase())
    );
    const lastAppointment = series.appointments[series.appointments.length - 1] || null;
    const nextAppointment = upcomingAppointments[0] || null;
    const appointmentForLink = nextAppointment || lastAppointment;

    const toOccurrence = (appointment: typeof nextAppointment) =>
      appointment
        ? {
            date: appointment.date.toISOString(),
            dateValue: getScheduleDateValue(appointment.date),
            time: formatScheduleTime(appointment.date),
          }
        : null;

    return {
      id: series.id,
      status: series.status,
      customerId: series.customerId,
      customerName:
        series.customer?.name || series.customerName || "Cliente sem nome",
      customerPhone: series.customer?.phone || series.customerPhone,
      customerEmail: series.customer?.email || null,
      registeredCustomer: Boolean(series.customerId && series.customer),
      barberId: series.barberId,
      barberName: series.barber.name || series.barber.email || "Barbeiro",
      serviceNames: series.serviceIds.map(
        (serviceId) => serviceNames.get(serviceId) || "Serviço removido"
      ),
      frequency: formatFrequency(series.frequency),
      frequencyCode: series.frequency,
      time: series.time,
      startDate: formatScheduleDate(series.startDate),
      endDate: series.endDate ? formatScheduleDate(series.endDate) : null,
      unlimited: series.unlimited,
      totalOccurrences: series.appointments.length,
      upcomingOccurrences: upcomingAppointments.length,
      nextOccurrence: toOccurrence(nextAppointment),
      lastOccurrence: toOccurrence(lastAppointment),
      agendaDate: appointmentForLink
        ? getScheduleDateValue(appointmentForLink.date)
        : getScheduleDateValue(series.startDate),
    };
  });

  return (
    <DashboardShell size="wide" className="min-w-0 max-w-full overflow-hidden px-3 sm:px-4">
      <section className="dashboard-panel max-w-full p-3 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              <Repeat2 className="h-4 w-4" aria-hidden="true" />
              Agendamentos programados
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Clientes recorrentes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Acesse todas as séries, acompanhe as próximas ocorrências e cancele uma série inteira quando precisar.
            </p>
          </div>
        </div>

        <RecurringAppointmentCreator
          barbers={barbers as AdminAgendaBarber[]}
          services={services.map((service) => ({
            ...service,
            price: toMoneyNumber(service.price),
          })) as AdminAgendaService[]}
          extras={extras.map((extra) => ({
            ...extra,
            price: toMoneyNumber(extra.price),
          })) as AdminAgendaExtra[]}
          customers={customers.map((customer) => ({
            ...customer,
            name: customer.name || "Cliente",
          })) as AdminAgendaCustomer[]}
          selectedDate={today}
        />

        <RecurringClientsClient items={items} />
      </section>
    </DashboardShell>
  );
}
