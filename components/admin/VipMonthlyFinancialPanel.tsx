import { formatCurrency } from "@/lib/utils";
import type { VipMonthlyFinancialSummary } from "@/lib/vipFinancials";

export default function VipMonthlyFinancialPanel({
  summary,
  compact = false,
}: {
  summary: VipMonthlyFinancialSummary;
  compact?: boolean;
}) {
  return (
    <section className="max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4">
      <div className="mb-4 border-b border-white/10 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--brand-strong)]">
          Assinaturas VIP
        </p>
        <div className="mt-1 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-xl font-black text-white">Analise financeira mensal</h2>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            Ciclo {summary.cycleMonth}
          </span>
        </div>
      </div>

      <div
        className={`grid min-w-0 gap-2 ${
          compact ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"
        }`}
      >
        <VipFinanceTile
          label="Previsto"
          value={formatCurrency(summary.expectedRevenue)}
          helper={`${summary.activeCount} assinante(s) ativo(s)`}
          featured={!compact}
        />
        <VipFinanceTile
          label="Pago"
          value={formatCurrency(summary.paidRevenue)}
          helper={`${summary.paidCount} pagamento(s) confirmado(s)`}
          tone="success"
        />
        <VipFinanceTile
          label="Pendente"
          value={formatCurrency(summary.pendingRevenue)}
          helper={`${summary.pendingCount} em aberto`}
          tone="warning"
        />
        {!compact ? (
          <VipFinanceTile
            label="Planos"
            value={`${summary.planBreakdown.length}`}
            helper="tipos ativos no ciclo"
          />
        ) : null}
      </div>

      {summary.planBreakdown.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {summary.planBreakdown.map((plan) => (
            <div
              key={plan.planId}
              className="grid min-w-0 gap-2 border-t border-white/10 pt-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <p className="truncate font-black text-white">{plan.planName}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {plan.count} assinante(s)
                </p>
              </div>
              <div className="grid gap-1 text-xs sm:min-w-[160px]">
                <PlanMoneyRow label="Pago" value={plan.paidRevenue} tone="success" />
                <PlanMoneyRow
                  label="Pendente"
                  value={plan.pendingRevenue}
                  tone="warning"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">
          Nenhum assinante ativo neste ciclo.
        </p>
      )}
    </section>
  );
}

function VipFinanceTile({
  label,
  value,
  helper,
  tone = "neutral",
  featured = false,
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "success" | "warning";
  featured?: boolean;
}) {
  const valueClass =
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
      <p className="truncate text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 truncate text-lg font-black leading-tight ${valueClass}`}>
        {value}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-400">
        {helper}
      </p>
    </div>
  );
}

function PlanMoneyRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning";
}) {
  const toneClass = tone === "success" ? "text-emerald-300" : "text-amber-300";

  return (
    <p className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <strong className={`shrink-0 text-right font-black ${toneClass}`}>
        {formatCurrency(value)}
      </strong>
    </p>
  );
}
