import {
  CalendarDays,
  Wallet,
} from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { normalizeAppointmentStatus } from "@/lib/appointmentStatus";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
  getAppointmentTotalBarberPayout,
} from "@/lib/appointmentServices";
import { appointmentForBarberSelect } from "@/lib/appointmentSelects";
import { getBarberTipRows, getBarberTipsTotal } from "@/lib/barberTips";
import {
  getManualFitInCustomerDisplay,
  getManualFitInVisibleNotes,
} from "@/lib/manualFitIn";
import { toMoneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  getCurrentScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";
import { requireActiveBarber } from "../guard";
import BarberFinanceFilters from "./BarberFinanceFilters";
import FinanceAppointmentCard from "./FinanceAppointmentCard";

type SearchParams = {
  start?: string | string[];
  end?: string | string[];
};

export default async function BarberFinancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const filters = (await searchParams) || {};
  const { barber } = await requireActiveBarber();
  const data = await getBarberFinanceData(barber.id, barber.shopId, filters);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-white">
      <BackLink href="/barber" area="Painel" className="mb-5" />

      <PageHeader
        eyebrow="Meu financeiro"
        title={`Financeiro de ${barber.name || "Barbeiro"}`}
        description="Consulte seus repasses por período e veja quanto cada atendimento gerou para você."
        variant="plain"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.25)] backdrop-blur sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Consulta
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Filtrar período</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-400">
                Escolha o período para consultar somente repasses já confirmados.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <BarberFinanceFilters
              start={data.filters.start}
              end={data.filters.end}
            />
          </div>
        </section>

        <section className="grid gap-3">
          <FinanceMetricCard
            icon={<Wallet />}
            label="Repasse confirmado"
            value={formatCurrency(data.summary.completedPayout)}
            helper={`${data.summary.completedCount} atendimento(s) concluido(s)`}
            details={[
              {
                label: "Servicos",
                value: formatCurrency(data.summary.servicePayout),
              },
              {
                label: "Retiradas",
                value: formatCurrency(data.summary.deliveredItemsPayout),
              },
              {
                label: "Caixinhas",
                value: formatCurrency(data.summary.tipsTotal),
              },
            ]}
            tone="emerald"
            featured
          />
        </section>
      </div>

      <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Atendimentos
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Atendimentos
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Atendimentos do período com serviços, retiradas entregues e repasse.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-zinc-300">
            {data.appointments.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {data.appointments.length === 0 ? (
            <EmptyState
              title="Nenhum repasse no período"
              description="Ajuste o filtro para consultar outros atendimentos concluídos."
            />
          ) : (
            data.appointments.map((appointment) => (
              <FinanceAppointmentCard
                key={appointment.id}
                appointment={appointment}
                services={data.editServices}
                extras={data.editExtras}
              />
            ))
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Caixinhas
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Caixinhas do periodo
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Valores registrados como caixinha entram 100% no seu repasse.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-zinc-300">
            {formatCurrency(data.summary.tipsTotal)}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {data.tips.length === 0 ? (
            <EmptyState
              title="Nenhuma caixinha no periodo"
              description="Quando houver caixinhas registradas, elas aparecem aqui e entram no repasse."
            />
          ) : (
            data.tips.map((tip) => (
              <div
                key={tip.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {tip.clientName}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {tip.createdAt.toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-black text-[var(--brand-strong)]">
                    {formatCurrency(tip.amount)}
                  </p>
                </div>
                {tip.note ? (
                  <p className="mt-2 border-t border-white/10 pt-2 text-sm text-zinc-300">
                    {tip.note}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

async function getBarberFinanceData(
  barberId: string,
  shopId: string,
  searchParams: SearchParams
) {
  const range = resolveFinanceRange(searchParams);
  const [appointments, tipsSummary, tips] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        shopId,
        barberId,
        date: {
          gte: range.startDate,
          lte: range.endDate,
        },
        status: { in: ["COMPLETED", "DONE"] },
      },
      select: appointmentForBarberSelect,
      orderBy: {
        date: "desc",
      },
      take: 120,
    }),
    getBarberTipsTotal({
      barberId,
      range: {
        start: range.startDate,
        end: range.endDate,
      },
    }),
    getBarberTipRows({
      barberId,
      range: {
        start: range.startDate,
        end: range.endDate,
      },
    }),
  ]);

  const currentServiceIds = Array.from(
    new Set(
      appointments.flatMap((appointment) =>
        appointment.services.map((service) => service.serviceId)
      )
    )
  );
  const currentExtraIds = Array.from(
    new Set(
      appointments.flatMap((appointment) =>
        appointment.items.map((item) => item.extraProductId)
      )
    )
  );
  const [editServices, editExtras] = await Promise.all([
    prisma.service.findMany({
      where: {
        shopId,
        AND: [
          {
            OR: [{ barberId }, { barberId: null }],
          },
          {
            OR: [
              { isActive: true },
              ...(currentServiceIds.length ? [{ id: { in: currentServiceIds } }] : []),
            ],
          },
        ],
      },
      orderBy: [
        {
          barberId: "desc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
      },
    }),
    prisma.extraProduct.findMany({
      where: {
        shopId,
        OR: [
          {
            isActive: true,
            stock: {
              gt: 0,
            },
          },
          ...(currentExtraIds.length ? [{ id: { in: currentExtraIds } }] : []),
        ],
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
      },
    }),
  ]);

  const normalizedAppointments = appointments.map((appointment) => {
    const normalizedStatus = normalizeAppointmentStatus(appointment.status);
    const deliveredItems = appointment.items.filter((item) => item.isDelivered);
    const servicePayout = appointment.services.reduce(
      (sum, service) => sum + toMoneyNumber(service.barberPayoutSnapshot),
      0
    );
    const deliveredItemsPayout = deliveredItems.reduce(
      (sum, item) => sum + toMoneyNumber(item.barberPayoutSnapshot),
      0
    );
    const payoutTotal = getAppointmentTotalBarberPayout(
      appointment.services,
      appointment.items
    );
    const grossTotal = getAppointmentGrandTotal(appointment.services, deliveredItems);

    return {
      id: appointment.id,
      publicId: appointment.publicId,
      date: appointment.date,
      status: normalizedStatus,
      paymentMethod: appointment.paymentMethod,
      customerName: appointment.isManualFitIn
        ? getManualFitInCustomerDisplay({
            notes: appointment.notes,
            fallbackCustomer: appointment.customer,
          }).name
        : appointment.customer.name || "Cliente",
      barberId: appointment.barberId,
      serviceName: getAppointmentDisplayName(appointment.services),
      notes: appointment.isManualFitIn
        ? getManualFitInVisibleNotes(appointment.notes) || null
        : appointment.notes,
      services: appointment.services
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((service) => ({
          id: service.id,
          serviceId: service.serviceId,
          name: service.nameSnapshot,
          price: toMoneyNumber(service.priceSnapshot),
          payout: toMoneyNumber(service.barberPayoutSnapshot),
        })),
      items: appointment.items.map((item) => ({
        id: item.id,
        extraProductId: item.extraProductId,
        name: item.productNameSnapshot,
        quantity: item.quantity,
        subtotal: toMoneyNumber(item.subtotal),
        payout: toMoneyNumber(item.barberPayoutSnapshot),
        isDelivered: item.isDelivered,
      })),
      servicePayout,
      deliveredItemsPayout,
      payoutTotal,
      grossTotal,
    };
  });

  const completedAppointments = normalizedAppointments.filter(
    (appointment) => appointment.status === "COMPLETED"
  );
  return {
    filters: {
      start: range.start,
      end: range.end,
    },
    summary: {
      servicePayout: completedAppointments.reduce(
        (sum, appointment) => sum + appointment.servicePayout,
        0
      ),
      completedPayout: completedAppointments.reduce(
        (sum, appointment) => sum + appointment.payoutTotal,
        0
      ) + tipsSummary.tipsTotal,
      deliveredItemsPayout: completedAppointments.reduce(
        (sum, appointment) => sum + appointment.deliveredItemsPayout,
        0
      ),
      completedGross: completedAppointments.reduce(
        (sum, appointment) => sum + appointment.grossTotal,
        0
      ) + tipsSummary.tipsTotal,
      tipsTotal: tipsSummary.tipsTotal,
      tipsCount: tipsSummary.tipsCount,
      completedCount: completedAppointments.length,
    },
    appointments: normalizedAppointments,
    editServices: editServices.map((service) => ({
      ...service,
      price: toMoneyNumber(service.price),
    })),
    editExtras: editExtras.map((extra) => ({
      ...extra,
      price: toMoneyNumber(extra.price),
    })),
    tips,
  };
}

function FinanceMetricCard({
  icon,
  label,
  value,
  helper,
  details,
  tone,
  featured = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  details?: Array<{ label: string; value: string }>;
  tone: "emerald" | "sky" | "amber" | "neutral";
  featured?: boolean;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
      : tone === "sky"
      ? "border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]"
      : tone === "amber"
      ? "border-amber-300/20 bg-amber-400/10 text-amber-200"
      : "border-white/10 bg-black/20 text-zinc-200";

  return (
    <div
      className={`min-w-0 rounded-[20px] border p-3 backdrop-blur ${
        featured
          ? "border-emerald-300/25 bg-emerald-400/10"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
          <span className="[&>svg]:h-4.5 [&>svg]:w-4.5">{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </p>
          <p className="mt-1 break-words text-xl font-black text-white">{value}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-xs leading-5 text-zinc-400">{helper}</p>
      {details?.length ? (
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs text-zinc-300">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-center justify-between gap-3">
              <span>{detail.label}</span>
              <strong className="font-semibold text-white">{detail.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function resolveFinanceRange(searchParams: SearchParams) {
  const today = getCurrentScheduleDateValue();
  const parsedStart = parseDateValue(getFirstParam(searchParams.start)) || today;
  const parsedEnd = parseDateValue(getFirstParam(searchParams.end)) || parsedStart;
  const start = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
  const end = parsedStart <= parsedEnd ? parsedEnd : parsedStart;
  const startRange = getScheduleDayRange(start) || getScheduleDayRange(today)!;
  const endRange = getScheduleDayRange(end) || startRange;

  return {
    start,
    end,
    startDate: startRange.start,
    endDate: endRange.end,
  };
}

function getFirstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateValue(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !getScheduleDayRange(value)) {
    return null;
  }

  return value;
}
