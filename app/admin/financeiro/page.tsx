import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import ExclusiveDetails from "@/components/ui/ExclusiveDetails";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
  getAppointmentTotalBarberPayout,
} from "@/lib/appointmentServices";
import {
  getManualFitInCustomerDisplay,
  getManualFitInVisibleNotes,
} from "@/lib/manualFitIn";
import { appointmentForAdminSelect } from "@/lib/appointmentSelects";
import { getFinanceDashboardData } from "@/lib/financeReports";
import { toMoneyNumber, type MoneyValue } from "@/lib/money";
import {
  paymentMethodLabel,
  type PaymentBreakdown,
} from "@/lib/paymentMethods";
import { normalizeAppointmentStatus } from "@/lib/appointmentStatus";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import FinancePeriodFilters from "./FinancePeriodFilters";
import FinanceHistoryFilters from "./FinanceHistoryFilters";
import GeneratePayoutsButton from "./GeneratePayoutsButton";
import PayoutActionPanel from "./PayoutActionPanel";
import FinanceAppointmentCard, {
  type FinanceAppointmentCardData,
  type FinanceEditExtraOption,
  type FinanceEditServiceOption,
} from "@/app/barber/financeiro/FinanceAppointmentCard";

function formatCurrency(value: MoneyValue) {
  return toMoneyNumber(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getPaymentBreakdownDetails(breakdown: PaymentBreakdown) {
  const details = (["PIX", "CASH", "CARD"] as const).map((method) => ({
    label: paymentMethodLabel(method),
    value: formatCurrency(breakdown[method]),
  }));

  if (breakdown.UNKNOWN > 0) {
    details.push({
      label: "Nao informado",
      value: formatCurrency(breakdown.UNKNOWN),
    });
  }

  return details;
}

function formatPaymentBreakdown(breakdown: PaymentBreakdown) {
  const parts = (["PIX", "CASH", "CARD"] as const).map(
    (method) => `${paymentMethodLabel(method)}: ${formatCurrency(breakdown[method])}`
  );

  if (breakdown.UNKNOWN > 0) {
    parts.push(`Nao informado: ${formatCurrency(breakdown.UNKNOWN)}`);
  }

  return parts.join(" · ");
}

function formatDate(value: string | Date) {
  return new Date(value instanceof Date ? value : `${value}T00:00:00`).toLocaleDateString(
    "pt-BR"
  );
}

async function getAdminFinanceAppointments({
  shopId,
  start,
  end,
}: {
  shopId: string;
  start: string;
  end: string;
}) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59.999`);
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: ["COMPLETED", "DONE"],
      },
    },
    select: appointmentForAdminSelect,
    orderBy: {
      date: "desc",
    },
    take: 180,
  });

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
  const [services, extras] = await Promise.all([
    prisma.service.findMany({
      where: {
        shopId,
        OR: [
          { isActive: true },
          ...(currentServiceIds.length ? [{ id: { in: currentServiceIds } }] : []),
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
        barberId: true,
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
  const normalizedAppointments: FinanceAppointmentCardData[] = appointments.map(
    (appointment) => {
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
        barberName: appointment.barber.name || "Barbeiro",
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
    }
  );
  const appointmentsByBarber = new Map<string, FinanceAppointmentCardData[]>();

  for (const appointment of normalizedAppointments) {
    if (!appointment.barberId) continue;
    const current = appointmentsByBarber.get(appointment.barberId) || [];
    current.push(appointment);
    appointmentsByBarber.set(appointment.barberId, current);
  }

  return {
    appointmentsByBarber,
    services: services.map((service) => ({
      ...service,
      price: toMoneyNumber(service.price),
    })) as Array<FinanceEditServiceOption & { barberId: string | null }>,
    extras: extras.map((extra) => ({
      ...extra,
      price: toMoneyNumber(extra.price),
    })) as FinanceEditExtraOption[],
  };
}

export default async function AdminFinanceiroPage({
  searchParams,
}: {
  searchParams?: Promise<{
    period?: "week" | "month" | "custom";
    start?: string;
    end?: string;
    historyStart?: string;
    historyEnd?: string;
    compareMode?: "auto" | "custom";
    compareStart?: string;
    compareEnd?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const data = await getFinanceDashboardData({
    shopId,
    period: resolvedSearchParams.period,
    start: resolvedSearchParams.start,
    end: resolvedSearchParams.end,
    historyStart: resolvedSearchParams.historyStart,
    historyEnd: resolvedSearchParams.historyEnd,
    compareMode: resolvedSearchParams.compareMode,
    compareStart: resolvedSearchParams.compareStart,
    compareEnd: resolvedSearchParams.compareEnd,
  });
  const financeAppointments = await getAdminFinanceAppointments({
    shopId,
    start: data.filters.start,
    end: data.filters.end,
  });
  const maxDailyRevenue = Math.max(
    ...data.analytics.dailySeries.map((item) => item.grossRevenue),
    1
  );
  const maxServiceRevenue = Math.max(
    ...data.analytics.topServices.map((item) => item.grossRevenue),
    1
  );
  const maxBarberRevenue = Math.max(
    ...data.analytics.barberInsights.map((item) => item.grossRevenue),
    1
  );

  return (
    <DashboardShell size="wide" className="min-w-0 max-w-full overflow-hidden">
      <section className="dashboard-panel max-w-full p-3 sm:p-5">
        <div className="border-b border-white/10 pb-5">
          <BackLink href="/admin" area="Admin" />

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Painel admin
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Financeiro</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Entradas, repasses e fechamento dos barbeiros no período selecionado.
          </p>
        </div>

        <section className="border-b border-white/10 py-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Período
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Filtro financeiro</h2>
          </div>
          <div className="max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3.5">
            <FinancePeriodFilters
              period={data.filters.period}
              start={data.filters.start}
              end={data.filters.end}
            />
          </div>
        </section>

        <section className="border-b border-white/10 py-5">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FinanceStat
              label="Entrou"
              value={formatCurrency(data.summary.grossRevenue)}
              helper="serviços, retiradas e caixinhas"
              details={getPaymentBreakdownDetails(data.summary.paymentBreakdown)}
              featured
            />
            <FinanceStat
              label="A pagar"
              value={formatCurrency(data.summary.commissionTotal)}
              helper="repasses + caixinhas"
              tone="warning"
            />
            <FinanceStat
              label="Barbearia"
              value={formatCurrency(data.summary.shopNetRevenue)}
              helper="valor da casa"
              tone="success"
            />
            <FinanceStat
              label="Atendimentos"
              value={data.summary.appointmentsCount}
              helper="concluídos"
            />
          </div>
        </section>

        <div className="grid gap-5 pt-5">
          <FinancePanel
            eyebrow="Leitura rápida"
            title="Resumo do período"
            description="Ticket médio, melhor dia e movimento."
          >
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2 xl:grid-cols-4">
              <InsightTile
                label="Ticket médio"
                value={formatCurrency(data.summary.averageTicket)}
                helper="por atendimento"
              />
              <InsightTile
                label="Melhor dia"
                value={data.analytics.topDay?.label || "--"}
                helper={
                  data.analytics.topDay
                    ? formatCurrency(data.analytics.topDay.grossRevenue)
                    : "sem dados"
                }
              />
              <InsightTile
                label="Dia mais cheio"
                value={data.analytics.busiestDay?.label || "--"}
                helper={
                  data.analytics.busiestDay
                    ? `${data.analytics.busiestDay.appointmentsCount} atendimentos`
                    : "sem movimento"
                }
              />
              <InsightTile
                label="Dia da semana"
                value={data.analytics.weekdayPerformance[0]?.label || "--"}
                helper={
                  data.analytics.weekdayPerformance[0]
                    ? formatCurrency(data.analytics.weekdayPerformance[0].grossRevenue)
                    : "sem histórico"
                }
              />
            </div>
          </FinancePanel>

          <FinancePanel
            eyebrow="Movimento"
            title="Por dia"
            description="Receita e atendimentos concluídos."
          >
            {data.analytics.dailySeries.length === 0 ? (
              <EmptyState
                title="Sem movimento no período"
                description="Quando houver atendimentos concluídos, a série diária aparecerá aqui."
              />
            ) : (
              <div className="space-y-3">
                {data.analytics.dailySeries.map((day) => (
                  <div
                    key={day.date}
                    className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{day.label}</p>
                      <p className="text-xs text-zinc-500">
                        {day.appointmentsCount} atendimento(s)
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-[var(--brand)]"
                        style={{
                          width: `${Math.max(
                            10,
                            (day.grossRevenue / maxDailyRevenue) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-sm font-bold text-white">
                      {formatCurrency(day.grossRevenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FinancePanel>

          <FinancePanel
            eyebrow="Equipe"
            title="Valores por barbeiro"
            description="Venda, repasse e valor da barbearia por profissional."
          >
            {data.analytics.barberInsights.length === 0 ? (
              <EmptyState
                title="Sem comparativo por barbeiro"
                description="O gráfico aparece quando houver faturamento no período."
              />
            ) : (
              <div className="space-y-3">
                {data.analytics.barberInsights.map((barber) => (
                  <div key={barber.barberId} className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="truncate font-bold text-white">{barber.barberName}</p>
                      <p className="shrink-0 text-xs text-zinc-400">
                        {barber.appointmentsCount} atendimento(s)
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <MetricBar
                        label="Vendido"
                        value={barber.grossRevenue}
                        color="bg-sky-400"
                        maxValue={maxBarberRevenue}
                      />
                      <MetricBar
                        label="Repasse"
                        value={barber.commissionTotal}
                        color="bg-amber-400"
                        maxValue={maxBarberRevenue}
                      />
                      <MetricBar
                        label="Casa"
                        value={barber.shopNetRevenue}
                        color="bg-emerald-400"
                        maxValue={maxBarberRevenue}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FinancePanel>

          <FinancePanel
            eyebrow="Serviços"
            title="Mais vendidos"
            description="Serviços que mais geraram receita no período."
          >
            {data.analytics.topServices.length === 0 ? (
              <EmptyState
                title="Sem serviços no período"
                description="Os serviços mais vendidos aparecerão aqui quando houver faturamento."
              />
            ) : (
              <div className="space-y-2.5">
                {data.analytics.topServices.slice(0, 5).map((service) => (
                  <div key={service.label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-white">{service.label}</p>
                      <p className="shrink-0 text-xs text-zinc-400">{service.count}x</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{
                          width: `${Math.max(
                            12,
                            (service.grossRevenue / maxServiceRevenue) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-sm font-bold text-emerald-300">
                      {formatCurrency(service.grossRevenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FinancePanel>

          <FinancePanel
            eyebrow="Repasses"
            title="Fechamento dos barbeiros"
            description="Confira os valores do período e salve o fechamento."
            actions={
              <GeneratePayoutsButton
                filters={{
                  period: data.filters.period,
                  start: data.filters.start,
                  end: data.filters.end,
                  historyStart: data.filters.historyStart,
                  historyEnd: data.filters.historyEnd,
                  compareMode: data.filters.compareMode,
                  compareStart: data.filters.compareStart,
                  compareEnd: data.filters.compareEnd,
                }}
              />
            }
          >
            {data.barberPayouts.length === 0 ? (
              <EmptyState
                title="Nenhum fechamento para mostrar"
                description="Conclua atendimentos no período escolhido para gerar os repasses."
              />
            ) : (
              <div className="space-y-2.5">
                {data.barberPayouts.map((item) => (
                  <ExclusiveDetails
                    key={item.barberId}
                    group="admin-finance-payouts"
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                  >
                    <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-3 transition hover:bg-white/[0.035] [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-base font-bold text-white">
                            {item.barberName}
                          </p>
                          <PayoutStatusBadge status={item.savedStatus || "OPEN"} />
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-400">
                          {item.appointmentsCount} atendimentos · Repasse:{" "}
                          {formatCurrency(item.commissionTotal)}
                        </p>
                      </div>

                      <span className="text-lg text-zinc-500 group-open:hidden">+</span>
                      <span className="hidden text-lg text-zinc-500 group-open:block">-</span>
                    </summary>

                    <div className="border-t border-white/10 px-3.5 pb-3.5 pt-3">
                      <div className="grid gap-2 sm:grid-cols-4">
                        <PayoutValueTile
                          label="Servicos"
                          value={formatCurrency(item.serviceRevenue)}
                        />
                        <PayoutValueTile
                          label="Extras"
                          value={formatCurrency(item.extrasRevenue)}
                        />
                        <PayoutValueTile
                          label="Caixinhas"
                          value={formatCurrency(item.tipsTotal)}
                          tone="warning"
                        />
                        <PayoutValueTile
                          label="Total vendido"
                          value={formatCurrency(item.grossRevenue)}
                        />
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <PayoutValueTile
                          label="Repasse final"
                          value={formatCurrency(item.commissionTotal)}
                          tone="warning"
                        />
                        <PayoutValueTile
                          label="Barbearia"
                          value={formatCurrency(item.shopNetRevenue)}
                          tone="success"
                        />
                      </div>

                      {item.savedPaidAt ? (
                        <p className="mt-3 text-xs text-zinc-500">
                          Pago em {formatDate(item.savedPaidAt)}
                        </p>
                      ) : null}

                      {item.savedPayoutId ? (
                        <div className="mt-3">
                          <PayoutActionPanel
                            payoutId={item.savedPayoutId}
                            status={item.savedStatus || "OPEN"}
                          />
                        </div>
                      ) : null}

                      <div className="mt-4 border-t border-white/10 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                          Atendimentos do periodo
                        </p>
                        <div className="mt-2 space-y-2">
                          {(financeAppointments.appointmentsByBarber.get(item.barberId) || [])
                            .length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-white/10 p-3 text-sm text-zinc-400">
                              Nenhum atendimento concluido para revisar.
                            </p>
                          ) : (
                            (financeAppointments.appointmentsByBarber.get(item.barberId) || []).map(
                              (appointment) => (
                                <FinanceAppointmentCard
                                  key={appointment.id}
                                  appointment={appointment}
                                  mode="admin"
                                  services={financeAppointments.services.filter(
                                    (service) =>
                                      !service.barberId ||
                                      service.barberId === appointment.barberId
                                  )}
                                  extras={financeAppointments.extras}
                                />
                              )
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </ExclusiveDetails>
                ))}
              </div>
            )}
          </FinancePanel>

          <FinancePanel
            eyebrow="Histórico"
            title="Fechamentos salvos"
            description="Repasses gerados e pagos para consulta."
            actions={
              <FinanceHistoryFilters
                historyStart={data.filters.historyStart}
                historyEnd={data.filters.historyEnd}
              />
            }
          >
            {data.history.length === 0 ? (
              <EmptyState
                title="Sem histórico ainda"
                description="Os fechamentos realizados aparecerão aqui."
              />
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="table-premium min-w-[900px]">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Barbeiro</th>
                      <th className="px-4 py-3">Período</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Repasse</th>
                      <th className="px-4 py-3">Casa</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Pago em</th>
                      <th className="px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{item.barber.name || "Barbeiro"}</td>
                        <td className="px-4 py-3">
                          {formatDate(item.periodStart)} até {formatDate(item.periodEnd)}
                        </td>
                        <td className="px-4 py-3">{formatCurrency(item.grossRevenue)}</td>
                        <td className="px-4 py-3">{formatCurrency(item.commissionTotal)}</td>
                        <td className="px-4 py-3">{formatCurrency(item.shopNetRevenue)}</td>
                        <td className="px-4 py-3">
                          <PayoutStatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {item.paidAt ? formatDate(item.paidAt) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <PayoutActionPanel
                            payoutId={item.id}
                            status={item.status}
                            showDelete
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FinancePanel>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Comparativo
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Deseja comparar períodos anteriores?
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Abra uma tela dedicada para comparar com semana anterior, mês anterior ou datas personalizadas.
            </p>
            <Link
              href="/admin/financeiro/comparar"
              className="btn-secondary mt-4 w-full sm:w-auto"
            >
              Comparar períodos
            </Link>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}

function FinancePanel({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function FinanceStat({
  label,
  value,
  helper,
  tone = "neutral",
  details = [],
  featured = false,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: "neutral" | "success" | "warning";
  details?: Array<{ label: string; value: string }>;
  featured?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warning"
      ? "text-amber-300"
      : "text-white";

  return (
    <div
      className={`min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 ${
        featured ? "sm:col-span-2 xl:col-span-1" : ""
      }`}
    >
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 truncate text-lg font-bold leading-tight ${toneClass}`}>
        {value}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-400">
        {helper}
      </p>
      {details.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-2.5">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="flex min-w-0 items-center justify-between gap-3 text-xs"
            >
              <span className="min-w-0 truncate text-zinc-300">{detail.label}</span>
              <strong className="shrink-0 text-right font-black text-white tabular-nums">
                {detail.value}
              </strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InsightTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-bold text-white">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-zinc-400">{helper}</p>
    </div>
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      variant={
        status === "PAID" ? "success" : status === "CLOSED" ? "warning" : "neutral"
      }
    >
      {status === "PAID" ? "Pago" : status === "CLOSED" ? "Fechado" : "Aberto"}
    </StatusBadge>
  );
}

function PayoutValueTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warning"
      ? "text-amber-300"
      : "text-white";

  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
  maxValue,
}: {
  label: string;
  value: number;
  color: string;
  maxValue: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center">
      <p className="truncate text-xs text-zinc-300">{label}</p>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${Math.max(10, (value / Math.max(maxValue, 1)) * 100)}%`,
          }}
        />
      </div>
      <p className="text-xs font-bold text-white">{formatCurrency(value)}</p>
    </div>
  );
}
