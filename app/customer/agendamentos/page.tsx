import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, requireTenantSession } from "@/lib/tenantSession";
import DashboardShell from "@/components/ui/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import ExclusiveDetails from "@/components/ui/ExclusiveDetails";
import { getAppointmentItemsLabel } from "@/lib/appointmentItems";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
  getAppointmentServiceMetaLine,
} from "@/lib/appointmentServices";
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
} from "@/lib/appointmentStatus";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import {
  formatScheduleDate,
  formatScheduleTime,
  isScheduleDateTimePast,
} from "@/lib/scheduleTime";
import CancelAppointmentButton from "./CancelAppointmentButton";
import ReviewForm from "./ReviewForm";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export default async function CustomerAppointmentsPage() {
  noStore();

  const { session } = await requireTenantSession({
    roles: CUSTOMER_ROLES,
  });

  const appointments = await prisma.appointment.findMany({
      where: {
        customerId: session.user.id,
        isManualFitIn: false,
      },
      select: {
        id: true,
        publicId: true,
        date: true,
        status: true,
        paymentMethod: true,
        notes: true,
        barber: {
          select: {
            name: true,
            phone: true,
          },
        },
        items: {
          select: {
            productNameSnapshot: true,
            quantity: true,
            subtotal: true,
          },
        },
        services: {
          select: {
            nameSnapshot: true,
            orderIndex: true,
            priceSnapshot: true,
            durationSnapshot: true,
            bufferAfter: true,
          },
        },
        review: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
  });

  return (
    <DashboardShell>
      <section className="mb-5 sm:mb-6">
        <h1 className="break-words text-3xl font-bold text-white sm:text-4xl">
          Meus agendamentos
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-[15px]">
          Veja seus horários e acompanhe o status de cada atendimento em uma página so.
        </p>

        <div className="mt-5 flex items-center justify-end gap-3">
          <Link href="/agendar" className="btn-primary min-w-0 px-4">
            Novo agendamento
          </Link>
        </div>
      </section>

      {appointments.length === 0 ? (
        <SectionCard
          title="Agenda do cliente"
          description="Cada card abaixo concentra data, hora, barbeiro, serviços e status."
        >
          <EmptyState
            title="Nenhum agendamento por enquanto"
            description="Quando você reservar seu primeiro horário, ele aparecerá aqui."
            actionLabel="Agendar agora"
            actionHref="/agendar"
          />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => {
            const date = new Date(appointment.date);
            const time = formatScheduleTime(date);
            const dateLabel = formatScheduleDate(date, {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            });
            const serviceLabel = getAppointmentDisplayName(appointment.services);
            const serviceMetaLine = getAppointmentServiceMetaLine(
              appointment.services
            );
            const whatsappMessage =
              `Ola! Quero falar sobre meu agendamento de ${dateLabel} as ${time} com ${appointment.barber.name || "o barbeiro"} para ${serviceLabel}.`;
            const whatsappHref = buildWhatsAppUrl(appointment.barber.phone || "", whatsappMessage);
            const canShowCancel = ![
              "CANCELLED",
              "COMPLETED",
              "DONE",
              "NO_SHOW",
            ].includes(appointment.status);
            const canCancel = canShowCancel && !isScheduleDateTimePast(date);
            const canReview = ["COMPLETED", "DONE"].includes(appointment.status);
            const extrasLabel = getAppointmentItemsLabel(appointment.items);
            const hasExtras = appointment.items.length > 0;
            const totalLabel = getAppointmentGrandTotal(
              appointment.services,
              appointment.items
            ).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });

            return (
              <ExclusiveDetails
                key={appointment.id}
                group="customer-appointments"
                className="group relative max-w-full overflow-hidden rounded-[24px] border border-white/10 bg-black/25 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)] transition open:border-white/20 open:bg-[linear-gradient(145deg,rgba(20,24,34,0.96),rgba(8,12,20,0.98))]"
              >
                <summary className="cursor-pointer list-none outline-none [&::-webkit-details-marker]:hidden">
                  <StatusBadge
                    variant={appointmentStatusVariant(appointment.status)}
                    className="absolute right-4 top-4 w-fit max-w-[130px] shrink-0 justify-center px-2.5 py-1 text-[10px]"
                  >
                    {appointmentStatusLabel(appointment.status)}
                  </StatusBadge>
                  {canReview ? (
                    <span className="absolute right-4 top-12 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">
                      {paymentMethodLabel(appointment.paymentMethod)}
                    </span>
                  ) : null}

                  <div className="min-w-0 pr-28">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
                      {formatAppointmentPublicId(appointment.publicId)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {dateLabel}
                    </p>
                    <p className="text-2xl font-bold text-white">{time}</p>
                    <p className="mt-2 truncate text-base font-semibold text-white">
                      {appointment.barber.name || "Barbeiro"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-400">
                      {serviceLabel}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {serviceMetaLine}
                    </p>
                  </div>

                  <span className="absolute bottom-4 right-4 text-lg leading-none text-zinc-500">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">-</span>
                  </span>
                </summary>

                <div className="mt-3 border-t border-white/10 pt-3">
                  {appointment.notes ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
                        Observação
                      </p>
                      <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-zinc-200">
                        {appointment.notes}
                      </p>
                    </div>
                  ) : null}

                  {hasExtras ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
                        Extras
                      </p>
                      <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-zinc-200">
                        {extrasLabel}
                      </p>
                      <p className="mt-1.5 text-xs text-zinc-500">
                        Total com extras: {totalLabel}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center gap-2">
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      {canCancel ? (
                        <Link
                          href={`/agendar?remarcar=${appointment.id}`}
                          className="btn-primary min-h-11 rounded-xl px-3 py-2 text-sm shadow-none"
                        >
                          Remarcar
                        </Link>
                      ) : null}
                      {canCancel ? (
                        <CancelAppointmentButton appointmentId={appointment.id} />
                      ) : canShowCancel ? (
                        <button
                          type="button"
                          disabled
                          className="btn-danger w-full sm:w-auto"
                        >
                          Cancelar agendamento
                        </button>
                      ) : null}
                    </div>
                    {whatsappHref ? (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-500 text-white shadow-[0_14px_34px_rgba(34,197,94,0.28)] transition hover:scale-105 hover:bg-emerald-400"
                        aria-label="Falar no WhatsApp"
                      >
                        <WhatsAppIcon />
                      </a>
                    ) : null}
                  </div>

                  {canReview ? (
                    appointment.review ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                        <p className="text-sm font-semibold text-white">
                          Avaliação enviada
                        </p>
                        <p className="mt-1.5 text-sm leading-5 text-zinc-300">
                          Obrigado pelo feedback. Sua avaliação foi registrada.
                        </p>
                      </div>
                    ) : (
                      <ReviewForm appointmentId={appointment.id} />
                    )
                  ) : null}
                </div>
              </ExclusiveDetails>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 448 512"
      className="h-5 w-5 shrink-0"
      fill="currentColor"
    >
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 1.9 131.6 1.9 254c0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7C49.1 322.8 39.4 288.9 39.4 254c0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.5-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.5-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.6-6.6z" />
    </svg>
  );
}
