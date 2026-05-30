import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { getFinanceDashboardData } from "@/lib/financeReports";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import ComparisonControls from "../ComparisonControls";
import FinancePeriodFilters from "../FinancePeriodFilters";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDelta(
  current: number,
  previous: number,
  mode: "currency" | "number" = "currency"
) {
  const delta = current - previous;
  const prefix = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const absolute = Math.abs(delta);

  if (mode === "number") {
    return `${prefix}${absolute.toLocaleString("pt-BR")}`;
  }

  return `${prefix}${formatCurrency(absolute)}`;
}

function getDeltaTone(current: number, previous: number) {
  if (current > previous) return "text-emerald-300";
  if (current < previous) return "text-rose-300";
  return "text-zinc-300";
}

export default async function FinanceComparePage({
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
  const previousRangeLabel = `${formatDate(data.comparison.previousRange.start)} ate ${formatDate(
    data.comparison.previousRange.end
  )}`;

  return (
    <DashboardShell size="wide">
      <section className="dashboard-panel p-4 sm:p-5">
        <div className="border-b border-white/10 pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <BackLink href="/admin/financeiro" area="Financeiro" />

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
                Financeiro
              </p>
              <h1 className="mt-2 text-3xl font-bold text-white">Comparar períodos</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Compare o período atual com uma referência anterior ou datas personalizadas.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 lg:min-w-[18rem]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Referência anterior
              </p>
              <p className="mt-1 text-sm font-bold text-white">{previousRangeLabel}</p>
            </div>
          </div>
        </div>

        <section className="grid gap-4 border-b border-white/10 py-5 xl:grid-cols-[1fr_1.15fr] xl:items-start">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Período analisado
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Base da comparação</h2>
            </div>
            <FinancePeriodFilters
              period={data.filters.period}
              start={data.filters.start}
              end={data.filters.end}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Comparar com
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Opções rápidas</h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <ComparePreset
                href="/admin/financeiro/comparar?period=week&compareMode=auto"
                title="Semana anterior"
                description="Semana atual contra a semana passada."
                active={data.filters.period === "week" && data.filters.compareMode !== "custom"}
              />
              <ComparePreset
                href="/admin/financeiro/comparar?period=month&compareMode=auto"
                title="Mês anterior"
                description="Mês atual contra o mês passado."
                active={data.filters.period === "month" && data.filters.compareMode !== "custom"}
              />
              <ComparePreset
                href="/admin/financeiro/comparar?compareMode=custom"
                title="Data personalizada"
                description="Escolha manualmente o período anterior."
                active={data.filters.compareMode === "custom"}
              />
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <ComparisonControls
                period={data.filters.period}
                start={data.filters.start}
                end={data.filters.end}
                historyStart={data.filters.historyStart}
                historyEnd={data.filters.historyEnd}
                compareMode={data.filters.compareMode as "auto" | "custom"}
                compareStart={data.filters.compareStart}
                compareEnd={data.filters.compareEnd}
              />
            </div>
          </div>
        </section>

        <section className="pt-5">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Resultado
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Comparativo financeiro</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Resultado distribuído entre faturamento, repasse e volume.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <ComparisonCard
              label="Total faturado"
              current={formatCurrency(data.comparison.current.grossRevenue)}
              previous={formatCurrency(data.comparison.previous.grossRevenue)}
              delta={formatDelta(
                data.comparison.current.grossRevenue,
                data.comparison.previous.grossRevenue
              )}
              deltaTone={getDeltaTone(
                data.comparison.current.grossRevenue,
                data.comparison.previous.grossRevenue
              )}
            />
            <ComparisonCard
              label="Fica para a barbearia"
              current={formatCurrency(data.comparison.current.shopNetRevenue)}
              previous={formatCurrency(data.comparison.previous.shopNetRevenue)}
              delta={formatDelta(
                data.comparison.current.shopNetRevenue,
                data.comparison.previous.shopNetRevenue
              )}
              deltaTone={getDeltaTone(
                data.comparison.current.shopNetRevenue,
                data.comparison.previous.shopNetRevenue
              )}
              accent="success"
            />
            <ComparisonCard
              label="A pagar aos barbeiros"
              current={formatCurrency(data.comparison.current.commissionTotal)}
              previous={formatCurrency(data.comparison.previous.commissionTotal)}
              delta={formatDelta(
                data.comparison.current.commissionTotal,
                data.comparison.previous.commissionTotal
              )}
              deltaTone={getDeltaTone(
                data.comparison.current.commissionTotal,
                data.comparison.previous.commissionTotal
              )}
              accent="warning"
            />
            <ComparisonCard
              label="Atendimentos feitos"
              current={data.comparison.current.appointmentsCount}
              previous={data.comparison.previous.appointmentsCount}
              delta={formatDelta(
                data.comparison.current.appointmentsCount,
                data.comparison.previous.appointmentsCount,
                "number"
              )}
              deltaTone={getDeltaTone(
                data.comparison.current.appointmentsCount,
                data.comparison.previous.appointmentsCount
              )}
            />
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}

function ComparePreset({
  href,
  title,
  description,
  active,
}: {
  href: string;
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[6.5rem] flex-col justify-between rounded-2xl border p-3 transition ${
        active
          ? "border-[var(--brand)]/45 bg-[var(--brand-muted)]"
          : "border-white/10 bg-black/20 hover:border-[var(--brand)]/35 hover:bg-white/[0.04]"
      }`}
    >
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p>
    </Link>
  );
}

function ComparisonCard({
  label,
  current,
  previous,
  delta,
  deltaTone,
  accent = "neutral",
}: {
  label: string;
  current: string | number;
  previous: string | number;
  delta: string;
  deltaTone: string;
  accent?: "neutral" | "success" | "warning";
}) {
  const currentTone =
    accent === "success"
      ? "text-emerald-300"
      : accent === "warning"
      ? "text-amber-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="truncate text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 truncate text-2xl font-bold ${currentTone}`}>{current}</p>
      <p className="mt-2 truncate text-xs text-zinc-500">Anterior: {previous}</p>
      <p className={`mt-1 truncate text-xs font-semibold ${deltaTone}`}>
        Diferença: {delta}
      </p>
    </div>
  );
}
