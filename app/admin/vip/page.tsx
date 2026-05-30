import {
  CheckCircle2,
  Crown,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { formatCurrency } from "@/lib/utils";
import { ensureVipPlansForShop, getVipCycle, getVipPaymentDueDate } from "@/lib/vip";
import {
  cancelVipSubscriptionAction,
  changeVipPlanAction,
  markVipPaymentPaidAction,
  renewVipCycleAction,
} from "./actions";
import VipCreateForm from "./VipCreateForm";

export const metadata = {
  title: "Clientes VIP",
  description: "Gerenciamento de assinaturas mensais VIP.",
};

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getCustomerLabel(customer: {
  name: string | null;
  email: string | null;
  phone: string | null;
}) {
  return customer.name || customer.phone || customer.email || "Cliente sem nome";
}

function getPlanCombo(code: string) {
  if (code === "CORTE") {
    return "Corte";
  }

  if (code === "CORTE_SOBRANCELHA") {
    return "Corte + Sobrancelha";
  }

  if (code === "CORTE_BARBA_SOBRANCELHA") {
    return "Corte + Sobrancelha + Barba";
  }

  return "Combo mensal";
}

function getPlanSummary(code: string) {
  if (code === "CORTE") {
    return "Inclui 1 corte por semana.";
  }

  if (code === "CORTE_SOBRANCELHA") {
    return "Inclui 1 corte com sobrancelha por semana.";
  }

  if (code === "CORTE_BARBA_SOBRANCELHA") {
    return "Inclui 1 atendimento completo por semana.";
  }

  return "Inclui 1 atendimento semanal.";
}

export default async function AdminVipPage() {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });
  const plans = await ensureVipPlansForShop(prisma, shopId);
  const { cycleMonth } = getVipCycle();
  const dueDate = getVipPaymentDueDate();

  const [customers, subscriptions] = await Promise.all([
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
      take: 200,
    }),
    prisma.vipSubscription.findMany({
      where: {
        shopId,
        status: "ACTIVE",
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        plan: true,
        payments: {
          where: {
            cycleMonth,
          },
          take: 1,
        },
        usages: {
          orderBy: {
            usedAt: "desc",
          },
          take: 4,
        },
        _count: {
          select: {
            usages: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const activeCustomerIds = new Set(
    subscriptions.map((subscription) => subscription.customerId)
  );
  const availableCustomers = customers.filter(
    (customer) => !activeCustomerIds.has(customer.id)
  );
  const paidCount = subscriptions.filter(
    (subscription) => subscription.payments[0]?.status === "PAID"
  ).length;
  const pendingCount = subscriptions.length - paidCount;

  return (
    <DashboardShell size="wide" className="min-w-0 max-w-full overflow-hidden px-3 sm:px-4">
      <section className="dashboard-panel max-w-full p-3 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              <Crown className="h-4 w-4" aria-hidden="true" />
              Assinaturas
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Clientes VIP
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Adicione clientes aos planos, acompanhe pagamento mensal e veja os tokens
              usados quando o atendimento for concluido.
            </p>
          </div>

          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[420px]">
            <Metric label="Ativos" value={`${subscriptions.length}`} />
            <Metric label="Pagos" value={`${paidCount}`} tone="success" />
            <Metric label="Pendentes" value={`${pendingCount}`} tone="warning" />
          </div>
        </div>

        <section className="mt-7 max-w-full overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white">Adicionar VIP</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Busque o cliente, escolha o plano e libere a assinatura pelo painel.
              </p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Ciclo {cycleMonth} - vence {formatDate(dueDate)}
            </p>
          </div>

          <VipCreateForm
            customers={availableCustomers}
            plans={plans.map((plan) => ({
              id: plan.id,
              name: plan.name,
              combo: getPlanCombo(plan.code),
              price: Number(plan.price),
            }))}
          />
        </section>

        <section className="mt-7 grid max-w-full min-w-0 gap-4">
          {subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
              Nenhum cliente VIP ativo ainda.
            </div>
          ) : (
            subscriptions.map((subscription) => {
              const currentPayment = subscription.payments[0] || null;
              const isPaid = currentPayment?.status === "PAID";

              return (
                <article
                  key={subscription.id}
                  className="max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:rounded-3xl sm:p-5"
                >
                  <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-black text-white sm:text-2xl">
                            {getCustomerLabel(subscription.customer)}
                          </h2>
                          <p className="mt-1 truncate text-sm text-zinc-400">
                            {subscription.customer.phone || subscription.customer.email || "Sem contato"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                            isPaid
                              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                              : "border-amber-400/25 bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {isPaid ? (
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          )}
                          {isPaid ? "Pago" : "Pendente"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                        <CompactInfo label="Plano" value={subscription.plan.name} />
                        <CompactInfo
                          label="Tokens"
                          value={`${subscription.tokensRemaining}/${subscription.plan.tokensPerCycle}`}
                        />
                        <CompactInfo label="Usos" value={`${subscription._count.usages}`} />
                      </div>

                      {subscription.usages.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                            Ultimos usos
                          </p>
                          <div className="mt-3 grid gap-2">
                            {subscription.usages.map((usage) => (
                              <div
                                key={usage.id}
                                className="flex min-w-0 items-center justify-between gap-3 text-sm"
                              >
                                <span className="min-w-0 truncate text-zinc-300">
                                  {usage.serviceLabel}
                                </span>
                                <span className="shrink-0 text-zinc-500">
                                  {formatDate(usage.usedAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid min-w-0 gap-2">
                      <form action={markVipPaymentPaidAction} className="grid min-w-0 gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <input type="hidden" name="subscriptionId" value={subscription.id} />
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <p className="min-w-0 text-sm font-bold leading-5 text-zinc-300">
                            Vence em {formatLongDate(dueDate)}
                          </p>
                          <strong className="shrink-0 text-sm font-black text-white">
                            {formatCurrency(Number(subscription.plan.price))}
                          </strong>
                        </div>
                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isPaid}
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          {isPaid ? "Pagamento pago" : "Marcar como pago"}
                        </button>
                      </form>

                      <details className="rounded-2xl border border-white/10 bg-black/20 p-3 open:bg-black/30">
                        <summary className="cursor-pointer text-sm font-black text-zinc-300 marker:text-zinc-500">
                          Ajustes
                        </summary>

                        <div className="mt-3 grid min-w-0 gap-3 border-t border-white/10 pt-3">
                          <div className="rounded-2xl border border-[#d9ae55]/25 bg-[#d9ae55]/10 p-3">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e8c57d]">
                                  Plano atual
                                </p>
                                <h3 className="mt-1 truncate text-xl font-black text-white">
                                  {subscription.plan.name}
                                </h3>
                              </div>
                              <strong className="shrink-0 rounded-full bg-[#f1e8d8] px-3 py-1 text-xs font-black text-[#080807]">
                                {formatCurrency(Number(subscription.plan.price))}
                              </strong>
                            </div>

                            <p className="mt-3 text-sm font-black text-white">
                              {getPlanCombo(subscription.plan.code)}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-zinc-300">
                              {getPlanSummary(subscription.plan.code)} Sao 4 tokens mensais,
                              usados somente quando o atendimento for concluido.
                            </p>
                          </div>

                          <form action={changeVipPlanAction} className="grid min-w-0 gap-2">
                            <input type="hidden" name="subscriptionId" value={subscription.id} />
                            <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-300">
                              Mudar plano
                              <select
                                name="planId"
                                defaultValue={subscription.planId}
                                className="min-h-10 w-full min-w-0 rounded-lg border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[var(--brand)]"
                              >
                                {plans.map((plan) => (
                                  <option key={plan.id} value={plan.id}>
                                    {plan.name} - {getPlanCombo(plan.code)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="submit"
                              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#d9ae55]/35 bg-[#d9ae55]/10 px-3 text-sm font-black text-[#f5efe3] transition hover:bg-[#d9ae55]/20"
                            >
                              Mudar plano
                            </button>
                          </form>

                          <div className="grid grid-cols-2 gap-2">
                            <form action={renewVipCycleAction}>
                              <input type="hidden" name="subscriptionId" value={subscription.id} />
                              <button
                                type="submit"
                                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-black text-white transition hover:bg-white/10"
                              >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                Renovar
                              </button>
                            </form>
                            <form action={cancelVipSubscriptionAction}>
                              <input type="hidden" name="subscriptionId" value={subscription.id} />
                              <button
                                type="submit"
                                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 text-sm font-black text-red-200 transition hover:bg-red-500/20"
                              >
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                                Desativar
                              </button>
                            </form>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warning"
      ? "text-amber-300"
      : "text-white";

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-white/10 p-3 last:border-r-0">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white" title={value}>
        {value}
      </p>
    </div>
  );
}
