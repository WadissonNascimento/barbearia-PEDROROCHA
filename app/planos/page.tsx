import Link from "next/link";
import { Check, Crown, Scissors, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentShop } from "@/lib/shop";
import { CUSTOMER_ROLES, getTenantSession } from "@/lib/tenantSession";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  getActiveVipSubscriptionForCustomer,
  getVipPaymentDueDate,
  getWeekRange,
  hasPaidCurrentVipCycle,
} from "@/lib/vip";

export const metadata = {
  title: "Planos",
  description: "Combos mensais de corte da Pedro Rocha Barbearia.",
};

const ownerPhone = "11958257965";

const plans = [
  {
    name: "Bronze",
    combo: "Corte",
    price: "R$ 120",
    description: "Para manter o corte sempre alinhado durante o mes.",
    features: ["Corte incluso", "1 atendimento por semana", "4 tokens mensais"],
  },
  {
    name: "Prata",
    combo: "Corte + Sobrancelha",
    price: "R$ 140",
    description: "Corte em dia com acabamento de sobrancelha incluso.",
    features: ["Corte e sobrancelha", "1 atendimento por semana", "4 tokens mensais"],
    highlighted: true,
  },
  {
    name: "Ouro",
    combo: "Corte + Sobrancelha + Barba",
    price: "R$ 180",
    description: "O plano completo para cabelo, sobrancelha e barba.",
    features: ["Corte, sobrancelha e barba", "1 atendimento por semana", "4 tokens mensais"],
  },
];

const rules = [
  "Pagamento no 5 dia util",
  "Assinar o plano apenas se for mante-lo",
  "Direito a um atendimento por semana",
];

function planWhatsAppUrl(planName: string) {
  return (
    buildWhatsAppUrl(
      ownerPhone,
      `Ola! Tenho interesse no plano ${planName} da Pedro Rocha Barbearia.`
    ) || "/"
  );
}

function getPlanCombo(code: string) {
  if (code === "CORTE") {
    return "Bronze";
  }

  if (code === "CORTE_SOBRANCELHA") {
    return "Prata";
  }

  if (code === "CORTE_BARBA_SOBRANCELHA") {
    return "Ouro";
  }

  return "VIP";
}

function getPlanComboDescription(code: string) {
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

function getPlanItems(code: string) {
  if (code === "CORTE") {
    return "Corte";
  }

  if (code === "CORTE_SOBRANCELHA") {
    return "Corte e sobrancelha";
  }

  if (code === "CORTE_BARBA_SOBRANCELHA") {
    return "Corte, sobrancelha e barba";
  }

  return "Combo mensal";
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMonthName(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
  });
}

export default async function PlanosPage() {
  const shop = await getCurrentShop();
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });
  const activeSubscription = tenantSession
    ? await getActiveVipSubscriptionForCustomer(prisma, {
        shopId: shop.id,
        customerId: tenantSession.session.user.id,
      })
    : null;

  if (activeSubscription) {
    const paymentPaid = await hasPaidCurrentVipCycle(prisma, activeSubscription.id);
    const customerName =
      tenantSession?.session.user.name?.split(" ")[0] ||
      tenantSession?.session.user.email?.split("@")[0] ||
      "cliente";
    const planLevel = getPlanCombo(activeSubscription.plan.code);
    const planCombo = getPlanComboDescription(activeSubscription.plan.code);
    const planItems = getPlanItems(activeSubscription.plan.code);
    const { start: weekStart, end: weekEnd } = getWeekRange(new Date());
    const weeklyUsage = await prisma.vipUsage.findFirst({
      where: {
        subscriptionId: activeSubscription.id,
        usedAt: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      select: {
        id: true,
        usedAt: true,
      },
    });
    const nextPaymentDate = getVipPaymentDueDate(
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    );
    const currentMonthName = formatMonthName(new Date());
    const usages = await prisma.vipUsage.findMany({
      where: {
        subscriptionId: activeSubscription.id,
      },
      orderBy: {
        usedAt: "desc",
      },
      take: 12,
      include: {
        appointment: {
          select: {
            date: true,
            barber: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return (
      <main className="min-h-screen bg-[#050504] px-4 py-6 text-[#f5efe3] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-[#b8945f]/25 bg-[#0b0a09] shadow-[0_18px_54px_rgba(0,0,0,0.36)]">
            <div className="border-b border-[#b8945f]/15 bg-[linear-gradient(135deg,_rgba(184,148,95,0.18),_rgba(8,8,7,0.98))] p-5 sm:p-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#b8945f]/35 bg-[#b8945f]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#e8c57d]">
                <Crown className="h-4 w-4" aria-hidden="true" />
                Area VIP
              </p>
              <h1 className="mt-5 text-3xl font-black leading-tight text-[#f8f3e7] sm:text-5xl">
                Olá {customerName}, você é assinante do plano {planLevel}
              </h1>
            </div>

            <div className="divide-y divide-white/10 border-b border-white/10 bg-black/20 px-5 py-1">
              <VipInfoCard
                label="Itens do seu plano"
                value={planItems}
              />
              <VipInfoCard
                label="Semana"
                value={
                  weeklyUsage
                    ? "Atendimento da semana já utilizado"
                    : "1 atendimento disponível esta semana"
                }
                helper={
                  weeklyUsage
                    ? `Usado em ${weeklyUsage.usedAt.toLocaleDateString("pt-BR")}`
                    : "Você ainda não usou seu benefício semanal"
                }
                tone={weeklyUsage ? "warning" : "success"}
              />
              <VipInfoCard
                label="Pagamento"
                value={
                  paymentPaid
                    ? `${currentMonthName} está pago`
                    : `${currentMonthName} está pendente`
                }
                helper={`Próximo pagamento: ${formatLongDate(nextPaymentDate)}`}
                tone={paymentPaid ? "success" : "warning"}
              />
            </div>
          </div>

          <section className="mt-5 rounded-2xl border border-white/10 bg-[#0b0a09] p-5 sm:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e8c57d]">
                  Historico
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#f8f3e7]">
                  Usos do plano
                </h2>
              </div>
              <p className="text-sm font-bold text-[#c9c0b2]">
                Valor mensal: {formatCurrency(Number(activeSubscription.plan.price))}
              </p>
            </div>

            {usages.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-white/10 p-5 text-sm text-[#c9c0b2]">
                Nenhum token usado ainda. Quando o barbeiro concluir um atendimento VIP,
                ele aparece aqui.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {usages.map((usage) => (
                  <article
                    key={usage.id}
                    className="rounded-lg border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-[#f8f3e7]">{usage.serviceLabel}</p>
                        <p className="mt-1 text-sm text-[#c9c0b2]">
                          {usage.appointment.barber.name || "Barbeiro"}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-[#e8c57d]">
                        {new Date(usage.usedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="mt-6 flex justify-center">
            <Link
              href="/agendar"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f1e8d8] px-5 text-sm font-black text-[#080807] transition hover:bg-white sm:w-auto"
            >
              Agendar usando meu plano
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050504] text-[#f5efe3]">
      <section className="relative px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[#050504]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl border-b border-[#b8945f]/20 pb-9 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#b8945f]/35 bg-[#b8945f]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#e8c57d]">
              <Crown className="h-4 w-4" aria-hidden="true" />
              Assinaturas mensais
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight text-[#f8f3e7] sm:text-6xl">
              Combos de corte mensais
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#c9c0b2] sm:text-base">
              Planos Bronze, Prata e Ouro para manter o corte, a barba e o acabamento sempre em dia,
              com atendimento semanal e pagamento mensal.
            </p>
          </div>

          <section className="mt-8 rounded-lg border border-[#b8945f]/25 bg-[#0b0a09] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.36)] sm:p-7">
            <div className="mb-6 h-px bg-gradient-to-r from-transparent via-[#b8945f]/45 to-transparent" />
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[#e8c57d]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Regras
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#f8f3e7]">
                  Como funciona a assinatura
                </h2>
              </div>

              <ul className="grid gap-3 md:min-w-[420px]">
                {rules.map((rule) => (
                  <li key={rule} className="flex gap-3 rounded-lg border border-white/10 bg-black/30 p-4 text-sm font-bold text-[#ddd3c2]">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#e8c57d]" aria-hidden="true" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative overflow-hidden rounded-lg border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] ${
                  plan.highlighted
                    ? "border-[#d9ae55]/75 bg-[linear-gradient(180deg,_rgba(184,148,95,0.18),_rgba(16,14,12,0.96))]"
                    : "border-[#f1e8d8]/10 bg-[#0c0b0a]"
                }`}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f1e8d8]/35 to-transparent" />
                {plan.highlighted ? (
                  <span className="absolute right-4 top-4 rounded-full bg-[#d9ae55] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#080807]">
                    Mais escolhido
                  </span>
                ) : null}

                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#d9ae55]/30 bg-black/30 text-[#e8c57d]">
                  <Scissors className="h-6 w-6" aria-hidden="true" />
                </div>

                <h2 className="mt-5 text-3xl font-black leading-tight text-[#f8f3e7]">
                  {plan.name}
                </h2>
                <p className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-[#e8c57d]">
                  {plan.combo}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#c9c0b2]">
                  {plan.description}
                </p>

                <div className="mt-6 border-y border-[#f1e8d8]/10 py-5">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#e8c57d]">
                    por mes
                  </span>
                  <strong className="mt-2 block text-5xl font-black leading-none text-[#f8f3e7]">
                    {plan.price}
                  </strong>
                </div>

                <ul className="mt-5 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-6 text-[#ddd3c2]">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#e8c57d]" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={planWhatsAppUrl(plan.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#f1e8d8] px-5 text-sm font-black text-[#080807] shadow-[0_16px_34px_rgba(241,232,216,0.12)] transition hover:bg-white active:scale-[0.98]"
                >
                  Tenho interesse nesse
                </a>
              </article>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/agendar"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#f1e8d8]/15 bg-white/[0.03] px-5 text-sm font-bold text-[#f5efe3] transition hover:bg-white/[0.07]"
            >
              Voltar para agendamento
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function VipInfoCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warning"
      ? "text-amber-300"
      : "text-[#f8f3e7]";

  return (
    <div className="min-w-0 py-4">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#e8c57d] sm:text-xs">
        {label}
      </p>
      <p className={`mt-2 text-base font-black leading-6 sm:text-lg ${toneClass}`}>
        {value}
      </p>
      {helper ? (
        <p className="mt-1 truncate text-[11px] font-bold text-[#a89f91] sm:text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
