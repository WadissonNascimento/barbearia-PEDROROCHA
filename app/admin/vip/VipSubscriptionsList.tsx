"use client";

import {
  CalendarDays,
  CheckCircle2,
  PauseCircle,
  PencilLine,
  History,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  cancelVipSubscriptionAction,
  markVipPaymentPaidAction,
  pauseVipSubscriptionAction,
  reopenVipPaymentAction,
  updateVipSubscriptionSettingsAction,
} from "./actions";

type PlanOption = {
  id: string;
  name: string;
  code: string;
  combo: string;
  summary: string;
  price: number;
};

type SubscriptionItem = {
  id: string;
  planId: string;
  plan: PlanOption;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  payment: {
    status: string;
    dueDate: string | null;
  } | null;
  dueDay: number;
  dueDateLabel: string;
  usageCount: number;
  usages: Array<{
    id: string;
    serviceLabel: string;
    usedAt: string;
  }>;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function customerLabel(customer: SubscriptionItem["customer"]) {
  return customer.name || customer.phone || customer.email || "Cliente sem nome";
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function VipSubscriptionsList({
  subscriptions,
  plans,
}: {
  subscriptions: SubscriptionItem[];
  plans: PlanOption[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<string[]>([]);
  const [editingPlanIds, setEditingPlanIds] = useState<string[]>([]);

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    return subscriptions.filter((subscription) => {
      const isPaid = subscription.payment?.status === "PAID";
      const searchableText = normalizeSearch(
        [
          subscription.customer.name,
          subscription.customer.phone,
          subscription.customer.email,
          subscription.plan.name,
          subscription.plan.combo,
        ]
          .filter(Boolean)
          .join(" ")
      );

      if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
        return false;
      }

      if (statusFilter === "paid" && !isPaid) {
        return false;
      }

      if (statusFilter === "pending" && isPaid) {
        return false;
      }

      if (planFilter !== "all" && subscription.planId !== planFilter) {
        return false;
      }

      return true;
    });
  }, [planFilter, query, statusFilter, subscriptions]);

  return (
    <section className="mt-6 max-w-full rounded-3xl border border-white/10 bg-black/20 p-3 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Gerenciamento
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">Assinantes ativos</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Procure por cliente, telefone, plano ou status de pagamento.
          </p>
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_140px] lg:min-w-[580px]">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 focus-within:border-[var(--brand)]/50">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-11 rounded-2xl border border-white/10 bg-[#090909] px-3 text-sm font-bold text-white outline-none focus:border-[var(--brand)]/50"
          >
            <option value="all">Todos</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
          </select>

          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
            className="min-h-11 rounded-2xl border border-white/10 bg-[#090909] px-3 text-sm font-bold text-white outline-none focus:border-[var(--brand)]/50"
          >
            <option value="all">Planos</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid max-w-full min-w-0 gap-3">
        {filteredSubscriptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
            Nenhum assinante encontrado com esses filtros.
          </div>
        ) : (
          filteredSubscriptions.map((subscription) => {
            const isPaid = subscription.payment?.status === "PAID";
            const historyExpanded = expandedHistoryIds.includes(subscription.id);
            const visibleUsages = historyExpanded
              ? subscription.usages
              : subscription.usages.slice(0, 4);
            const hasMoreUsages = !historyExpanded && subscription.usages.length > 4;

            return (
              <details
                key={subscription.id}
                className="group relative max-w-full overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_18px_44px_rgba(0,0,0,0.2)]"
              >
                <summary className="grid cursor-pointer list-none gap-3 p-4 pt-10 [&::-webkit-details-marker]:hidden">
                  <div className="absolute right-4 top-4">
                    <StatusBadge paid={isPaid} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="break-words text-xl font-black leading-tight text-white">
                      {customerLabel(subscription.customer)}
                    </h3>
                    <p className="mt-1 truncate text-sm text-zinc-400">
                      {subscription.customer.phone ||
                        subscription.customer.email ||
                        "Sem contato"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-bold text-zinc-300">
                      Assinante:{" "}
                      <span className={getPlanColorClass(subscription.plan.name)}>
                        {subscription.plan.name}
                      </span>
                    </p>
                    <p className="truncate text-sm text-zinc-400">
                      {subscription.plan.combo}
                    </p>
                    <p className="text-sm font-bold text-zinc-300">
                      Usos:{" "}
                      <span className="font-black text-white">
                        {subscription.usageCount}
                      </span>
                    </p>
                  </div>
                </summary>

                <div className="border-t border-white/10 p-4 pt-3">
                  <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                        Vence todo dia {subscription.dueDay}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Neste ciclo: {subscription.dueDateLabel}
                      </p>
                    </div>
                    <strong className="shrink-0 text-sm font-black text-white">
                      {formatCurrency(subscription.plan.price)}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <form
                      action={
                        isPaid ? reopenVipPaymentAction : markVipPaymentPaidAction
                      }
                    >
                      <input type="hidden" name="subscriptionId" value={subscription.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d9ae55]/35 bg-[#d9ae55]/12 px-3 text-sm font-black text-[#f5efe3] transition hover:bg-[#d9ae55]/20 active:scale-[0.98]"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        {isPaid ? "Reabrir" : "Pagar"}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingPlanIds((current) =>
                          current.includes(subscription.id)
                            ? current.filter((id) => id !== subscription.id)
                            : [...current, subscription.id]
                          )
                      }
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-white transition hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.98]"
                    >
                      <PencilLine className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </button>

                    <form action={pauseVipSubscriptionAction}>
                      <input type="hidden" name="subscriptionId" value={subscription.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.08] px-3 text-sm font-black text-amber-100 transition hover:border-amber-300/35 hover:bg-amber-400/[0.14] active:scale-[0.98]"
                      >
                        <PauseCircle className="h-4 w-4" aria-hidden="true" />
                        Pausar
                      </button>
                    </form>

                    <form action={cancelVipSubscriptionAction}>
                      <input type="hidden" name="subscriptionId" value={subscription.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.08] px-3 text-sm font-black text-red-200 transition hover:border-red-300/35 hover:bg-red-500/[0.14] active:scale-[0.98]"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Cancelar
                      </button>
                    </form>
                  </div>

                  {editingPlanIds.includes(subscription.id) ? (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <form
                        action={updateVipSubscriptionSettingsAction}
                        onSubmit={() =>
                          setEditingPlanIds((current) =>
                            current.filter((id) => id !== subscription.id)
                          )
                        }
                        className="grid min-w-0 gap-2"
                      >
                        <input type="hidden" name="subscriptionId" value={subscription.id} />
                        <label className="grid min-w-0 gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                            Escolher plano
                          </span>
                          <select
                            name="planId"
                            defaultValue={subscription.planId}
                            className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-[#090909] px-3 pr-10 text-sm font-bold leading-tight text-white outline-none focus:border-[var(--brand)]"
                          >
                            {plans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} - {plan.combo}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid min-w-0 gap-1.5">
                          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            Dia de vencimento
                          </span>
                          <input
                            type="number"
                            name="dueDay"
                            min={1}
                            max={31}
                            inputMode="numeric"
                            defaultValue={subscription.dueDay}
                            className="min-h-12 w-full rounded-xl border border-white/10 bg-[#090909] px-3 text-sm font-bold text-white outline-none focus:border-[var(--brand)]"
                          />
                          <span className="text-xs text-zinc-500">
                            O vencimento sera aplicado todos os meses nesse dia.
                          </span>
                        </label>
                        <button
                          type="submit"
                          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d9ae55]/35 bg-[#d9ae55]/10 px-3 text-sm font-black text-[#f5efe3] transition hover:bg-[#d9ae55]/20"
                        >
                          Salvar modificacoes
                        </button>
                      </form>
                    </div>
                  ) : null}

                  <details className="mt-3 border-t border-white/10 pt-3">
                    <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-zinc-200 marker:text-zinc-500">
                    <History className="h-4 w-4" aria-hidden="true" />
                    Historico de cortes
                  </summary>
                  <div className="mt-3 grid gap-2">
                    {subscription.usages.length === 0 ? (
                      <p className="text-sm text-zinc-500">Nenhum uso registrado ainda.</p>
                    ) : (
                      <>
                        {visibleUsages.map((usage) => (
                          <div
                            key={usage.id}
                            className="flex min-w-0 items-center justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate text-zinc-300">
                              {usage.serviceLabel}
                            </span>
                            <span className="shrink-0 text-zinc-500">
                              {formatShortDate(usage.usedAt)}
                            </span>
                          </div>
                        ))}
                        {hasMoreUsages ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryIds((current) =>
                                current.includes(subscription.id)
                                  ? current
                                  : [...current, subscription.id]
                              )
                            }
                            className="min-h-10 rounded-xl border border-white/10 px-3 text-sm font-black text-white transition hover:bg-white/10"
                          >
                            Ver mais
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                  </details>
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}

function StatusBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
        paid
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-amber-400/25 bg-amber-400/10 text-amber-300"
      }`}
    >
      {paid ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {paid ? "Pago" : "Pendente"}
    </span>
  );
}

function getPlanColorClass(planName: string) {
  if (planName === "Ouro") {
    return "font-black text-amber-200";
  }

  if (planName === "Prata") {
    return "font-black text-zinc-200";
  }

  if (planName === "Bronze") {
    return "font-black text-orange-200";
  }

  return "font-black text-[var(--brand-strong)]";
}
