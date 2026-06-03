import { Crown } from "lucide-react";
import VipMonthlyFinancialPanel from "@/components/admin/VipMonthlyFinancialPanel";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { ensureVipPlansForShop, getVipCycle, getVipPaymentDueDate } from "@/lib/vip";
import { getVipMonthlyFinancialSummary } from "@/lib/vipFinancials";
import VipCreateForm from "./VipCreateForm";
import VipSubscriptionsList from "./VipSubscriptionsList";

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

  const [customers, subscriptions, vipFinancialSummary] = await Promise.all([
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
        },
        _count: {
          select: {
            usages: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    getVipMonthlyFinancialSummary(prisma, shopId),
  ]);

  const activeCustomerIds = new Set(
    subscriptions.map((subscription) => subscription.customerId)
  );
  const availableCustomers = customers.filter(
    (customer) => !activeCustomerIds.has(customer.id)
  );
  const planOptions = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    code: plan.code,
    combo: getPlanCombo(plan.code),
    summary: getPlanSummary(plan.code),
    price: Number(plan.price),
  }));
  const subscriptionItems = subscriptions.map((subscription) => ({
    id: subscription.id,
    planId: subscription.planId,
    plan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
      code: subscription.plan.code,
      combo: getPlanCombo(subscription.plan.code),
      summary: getPlanSummary(subscription.plan.code),
      price: Number(subscription.plan.price),
    },
    customer: subscription.customer,
    payment: subscription.payments[0]
      ? {
          status: subscription.payments[0].status,
        }
      : null,
    usageCount: subscription._count.usages,
    usages: subscription.usages.map((usage) => ({
      id: usage.id,
      serviceLabel: usage.serviceLabel,
      usedAt: usage.usedAt.toISOString(),
    })),
  }));

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
              Adicione clientes aos planos, acompanhe pagamento mensal e veja os usos
              registrados quando o atendimento for concluido.
            </p>
          </div>

          <div className="w-full min-w-0 lg:max-w-[560px]">
            <VipMonthlyFinancialPanel summary={vipFinancialSummary} compact />
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
            plans={planOptions.map((plan) => ({
              id: plan.id,
              name: plan.name,
              combo: plan.combo,
              price: plan.price,
            }))}
          />
        </section>

        <VipSubscriptionsList
          subscriptions={subscriptionItems}
          plans={planOptions}
          dueDateLabel={formatLongDate(dueDate)}
        />
      </section>
    </DashboardShell>
  );
}

