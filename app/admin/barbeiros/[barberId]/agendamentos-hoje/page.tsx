import { redirect } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  normalizeAppointmentStatus,
} from "@/lib/appointmentStatus";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { getAppointmentItemsLabel } from "@/lib/appointmentItems";
import {
  getManualFitInCustomerDisplay,
  getManualFitInVisibleNotes,
} from "@/lib/manualFitIn";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
  getAppointmentTotalBarberPayout,
} from "@/lib/appointmentServices";
import { toMoneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  formatScheduleTime,
  getCurrentScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";
import {
  AdminAppointmentActions,
  type AdminAgendaAppointment,
} from "@/app/admin/agenda/AdminAgendaClient";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

export const dynamic = "force-dynamic";

type AdminBarberRouteParams = {
  params: Promise<{ barberId: string }>;
};

export default async function BarberTodayAppointmentsPage({ params }: AdminBarberRouteParams) {
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
  });

  if (!barber) redirect("/admin/barbeiros");

  const { start, end } = getScheduleDayRange(getCurrentScheduleDateValue())!;
  const [appointments, barbers, services, extras] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        shopId,
        barberId: barber.id,
        date: {
          gte: start,
          lte: end,
        },
        status: {
          not: "CANCELLED",
        },
      },
      include: {
        customer: true,
        items: true,
        services: true,
      },
      orderBy: {
        date: "asc",
      },
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
      orderBy: {
        name: "asc",
      },
    }),
    prisma.service.findMany({
      where: {
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
        barberId: true,
      },
      orderBy: {
        name: "asc",
      },
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
      orderBy: {
        name: "asc",
      },
    }),
  ]);
  const adminServices = services.map((service) => ({
    ...service,
    price: toMoneyNumber(service.price),
  }));
  const adminExtras = extras.map((extra) => ({
    ...extra,
    price: toMoneyNumber(extra.price),
  }));

  return (
    <DashboardShell>
      <PageHeader
        eyebrow={barber.name || "Barbeiro"}
        title="Agendamentos de hoje"
        description="Somente os horários deste barbeiro no dia."
        actions={<BackLink href={`/admin/barbeiros/${barber.id}`} area="Perfil" />}
      />

      {appointments.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-400">
          Nenhum agendamento para hoje.
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => {
            const status = normalizeAppointmentStatus(appointment.status);
            const manualCustomer = getManualFitInCustomerDisplay({
              notes: appointment.notes,
              fallbackCustomer: appointment.customer,
            });
            const customerName = appointment.isManualFitIn
              ? manualCustomer.name
              : appointment.customer.name || "Cliente";
            const payoutPreviewItems = appointment.items.map((item) => ({
              ...item,
              isDelivered: true,
            }));
            const actionAppointment: AdminAgendaAppointment = {
              id: appointment.id,
              publicId: appointment.publicId,
              date: appointment.date,
              status: appointment.status,
              paymentMethod: appointment.paymentMethod,
              notes: appointment.isManualFitIn
                ? getManualFitInVisibleNotes(appointment.notes) || null
                : appointment.notes,
              barber: {
                id: barber.id,
                name: barber.name,
              },
              customer: {
                name: customerName,
                email: appointment.isManualFitIn
                  ? manualCustomer.email
                  : appointment.customer.email,
              },
              services: appointment.services.map((service) => ({
                serviceId: service.serviceId,
                nameSnapshot: service.nameSnapshot,
                orderIndex: service.orderIndex,
                priceSnapshot: toMoneyNumber(service.priceSnapshot),
              })),
              items: appointment.items.map((item) => ({
                extraProductId: item.extraProductId,
                productNameSnapshot: item.productNameSnapshot,
                quantity: item.quantity,
                subtotal: toMoneyNumber(item.subtotal),
              })),
            };

            return (
              <article
                key={appointment.id}
                className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,40,61,0.72),rgba(13,18,30,0.98))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-white">
                      {formatScheduleTime(appointment.date)}
                    </p>
                    <p className="mt-2 truncate font-semibold text-white">
                      {customerName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {getAppointmentDisplayName(appointment.services) || "Serviço"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge variant={appointmentStatusVariant(status)}>
                      {appointmentStatusLabel(status)}
                    </StatusBadge>
                    {status === "COMPLETED" ? (
                      <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">
                        {paymentMethodLabel(appointment.paymentMethod)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <InfoBox
                    label="Total"
                    value={formatCurrency(
                      getAppointmentGrandTotal(appointment.services, appointment.items)
                    )}
                  />
                  <InfoBox
                    label="Repasse"
                    value={formatCurrency(
                      getAppointmentTotalBarberPayout(appointment.services, payoutPreviewItems)
                    )}
                  />
                </div>

                <p className="mt-3 text-xs text-sky-200">
                  Extras: {getAppointmentItemsLabel(appointment.items)}
                </p>
                <div className="mt-3">
                  <AdminAppointmentActions
                    appointment={actionAppointment}
                    barbers={barbers}
                    services={adminServices}
                    extras={adminExtras}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
