import Link from "next/link";
import {
  CalendarDays,
  Scissors,
  Star,
  UserRound,
} from "lucide-react";
import DashboardShell from "@/components/ui/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import ExclusiveDetails from "@/components/ui/ExclusiveDetails";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { getAppointmentItemsLabel } from "@/lib/appointmentItems";
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
import type { MoneyValue } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, requireTenantSession } from "@/lib/tenantSession";
import {
  formatScheduleDate,
  formatScheduleTime,
  isScheduleDateTimePast,
} from "@/lib/scheduleTime";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import CancelAppointmentButton from "../customer/agendamentos/CancelAppointmentButton";
import ReviewForm from "../customer/agendamentos/ReviewForm";
import ProfileForm from "./ProfileForm";

type ProfileAppointment = {
  id: string;
  publicId: number;
  date: Date;
  status: string;
  paymentMethod: string | null;
  notes: string | null;
  barber: {
    name: string | null;
    phone: string | null;
  };
  review: {
    id: string;
  } | null;
  services: Array<{
    nameSnapshot: string;
    orderIndex: number;
    priceSnapshot: MoneyValue;
    durationSnapshot: number;
    bufferAfter: number;
  }>;
  items: Array<{
    productNameSnapshot: string;
    quantity: number;
    subtotal: MoneyValue;
  }>;
};

export default async function MeuPerfilPage() {
  const { session } = await requireTenantSession({
    roles: CUSTOMER_ROLES,
  });

  const [customer, appointmentStats, recentAppointments, pendingEmailChange] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
    }),
    prisma.appointment.findMany({
      where: {
        customerId: session.user.id,
        isManualFitIn: false,
      },
      select: {
        id: true,
        status: true,
        services: {
          select: {
            nameSnapshot: true,
            orderIndex: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    }),
    prisma.appointment.findMany({
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
        review: {
          select: {
            id: true,
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
        items: {
          select: {
            productNameSnapshot: true,
            quantity: true,
            subtotal: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 3,
    }),
    prisma.emailChangeRequest.findFirst({
      where: {
        userId: session.user.id,
      },
      select: {
        email: true,
        expiresAt: true,
      },
    }),
  ]);

  const favoriteServiceMap = new Map<string, number>();

  for (const appointment of appointmentStats) {
    const serviceName = getAppointmentDisplayName(appointment.services);
    favoriteServiceMap.set(
      serviceName,
      (favoriteServiceMap.get(serviceName) || 0) + 1
    );
  }

  const favoriteService =
    Array.from(favoriteServiceMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    null;
  const completedAppointments = appointmentStats.filter((appointment) =>
    ["COMPLETED", "DONE"].includes(appointment.status)
  );
  const customerName = customer?.name || "Cliente";

  return (
    <DashboardShell size="wide" className="min-w-0 max-w-full overflow-hidden">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,36,0.96),rgba(5,9,16,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/10 p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)]">
                <UserRound className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--brand-strong)]">
                  Perfil do cliente
                </p>
                <h1 className="mt-3 break-words text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                  {customerName}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                  Nome, e-mail e telefone em um painel simples para consulta e edição.
                </p>
              </div>
            </div>
          </div>

          <ProfileForm
            customer={{
              name: customer?.name || "",
              email: customer?.email || "",
              phone: customer?.phone || "",
            }}
            pendingEmailChange={
              pendingEmailChange
                ? {
                    email: pendingEmailChange.email,
                    expiresAt: pendingEmailChange.expiresAt.toISOString(),
                  }
                : null
            }
          />
        </div>

        <div className="grid min-w-0 gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4">
            <div className="grid gap-2">
              <MiniStat
                icon={<CalendarDays className="h-4 w-4" />}
                label="Atendimento"
                value={appointmentStats.length}
              />
              <MiniStat
                icon={<Star className="h-4 w-4" />}
                label="Concluídos"
                value={completedAppointments.length}
              />
              <MiniStat
                icon={<Scissors className="h-4 w-4" />}
                label="Favorito"
                value={favoriteService || "-"}
              />
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            <SectionCard
              title="Histórico recente"
              description="Os 3 registros mais recentes da sua conta."
              className="rounded-[28px]"
            >
              <div className="space-y-3">
                {appointmentStats.length === 0 ? (
                  <EmptyState
                    title="Sem atendimentos registrados"
                    description="Assim que você reservar ou concluir atendimentos, o histórico aparece aqui."
                    actionLabel="Agendar atendimento"
                    actionHref="/agendar"
                  />
                ) : (
                  <>
                    {recentAppointments.map((appointment) => (
                      <AppointmentHistoryCard
                        key={appointment.id}
                        appointment={appointment}
                      />
                    ))}

                    {appointmentStats.length > recentAppointments.length ? (
                      <Link
                        href="/customer/agendamentos"
                        className="btn-secondary min-h-11 w-full rounded-2xl px-4 py-3 text-sm"
                      >
                        Ver histórico completo
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </SectionCard>
          </main>
        </div>
      </section>
    </DashboardShell>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
      <p className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[var(--brand-strong)]">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </p>
      <p className="min-w-0 max-w-[8rem] truncate text-right text-lg font-black text-white tabular-nums">
        {value}
      </p>
    </div>
  );
}

function AppointmentHistoryCard({
  appointment,
}: {
  appointment: ProfileAppointment;
}) {
  const date = new Date(appointment.date);
  const time = formatScheduleTime(date);
  const dateLabel = formatScheduleDate(date, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const serviceLabel = getAppointmentDisplayName(appointment.services);
  const serviceMetaLine = getAppointmentServiceMetaLine(appointment.services);
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
      group="profile-recent-appointments"
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
          <p className="mt-1 text-xs text-zinc-500">{serviceMetaLine}</p>
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
