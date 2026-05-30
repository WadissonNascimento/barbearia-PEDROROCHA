import {
  CalendarRange,
  DollarSign,
  Landmark,
  MessageSquareText,
  PackagePlus,
  PiggyBank,
  Scissors,
  Settings,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import DashboardEntryCard from "@/components/ui/DashboardEntryCard";
import AdminNotificationsBell from "./AdminNotificationsBell";
import {
  getCurrentScheduleDateValue,
  getScheduleDayRange,
} from "@/lib/scheduleTime";
import { canAdminActAsBarber, ensureAdminBarberProfile } from "@/lib/barberAccess";
import { formatCurrency } from "@/lib/utils";
import { getAppointmentGrandTotal } from "@/lib/appointmentServices";
import {
  addToPaymentBreakdown,
  createEmptyPaymentBreakdown,
  paymentMethodLabel,
  type PaymentBreakdown,
} from "@/lib/paymentMethods";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

function getTodayRange() {
  return getScheduleDayRange(getCurrentScheduleDateValue())!;
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

export default async function AdminPage() {
  const { session, shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  if (canAdminActAsBarber(shopId)) {
    await ensureAdminBarberProfile(shopId);
  }

  const now = new Date();
  const { start: todayStart, end: todayEnd } = getTodayRange();
  const [
    activeBarbers,
    activeProducts,
    openPayouts,
    pendingInvites,
    visibleReviews,
    todayAppointmentsCount,
    canceledTodayAppointments,
    completedTodayAppointments,
    appNotifications,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        shopId,
        role: "BARBER",
        isActive: true,
      },
    }),
    prisma.product.count({
      where: {
        shopId,
        isActive: true,
      },
    }),
    prisma.barberPayout.count({
      where: {
        shopId,
        status: {
          in: ["OPEN", "CLOSED"],
        },
      },
    }),
    prisma.pendingRegistration.count({
      where: {
        shopId,
        role: "BARBER",
        expiresAt: {
          gt: now,
        },
      },
    }),
    prisma.review.count({
      where: {
        shopId,
        isVisible: true,
      },
    }),
    prisma.appointment.count({
      where: {
        shopId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        shopId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          in: ["CANCELED", "CANCELLED", "NO_SHOW"],
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        shopId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          in: ["COMPLETED", "DONE"],
        },
      },
      select: {
        paymentMethod: true,
        services: {
          select: {
            priceSnapshot: true,
          },
        },
        items: {
          select: {
            subtotal: true,
            isDelivered: true,
          },
        },
      },
    }),
    prisma.appNotification.findMany({
      where: {
        shopId,
        recipientUserId: session.user.id,
      },
      select: {
        id: true,
        type: true,
        eyebrow: true,
        title: true,
        body: true,
        actionUrl: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
  ]);
  const todayPaymentBreakdown = createEmptyPaymentBreakdown();
  const todayRevenue = completedTodayAppointments.reduce(
    (sum, appointment) => {
      const total = getAppointmentGrandTotal(
        appointment.services,
        appointment.items.filter((item) => item.isDelivered)
      );

      addToPaymentBreakdown(todayPaymentBreakdown, appointment.paymentMethod, total);

      return sum + total;
    },
    0
  );
  const entries = [
    {
      href: "/barber",
      icon: UserRound,
      title: "Atuar como barbeiro",
      description: "Agenda, encaixes e financeiro da barbearia.",
    },
    {
      href: "/admin/agenda",
      icon: CalendarRange,
      title: "Agenda geral",
      description: "Horários de todos os barbeiros em um lugar.",
    },
    {
      href: "/admin/barbeiros",
      icon: UsersRound,
      title: "Equipe",
      description: "Barbeiros, acessos e status.",
      badge: activeBarbers ? `${activeBarbers}` : undefined,
    },
    {
      href: "/admin/financeiro",
      icon: Landmark,
      title: "Financeiro",
      description: "Faturamento, repasses e fechamentos.",
      badge: openPayouts ? `${openPayouts}` : undefined,
    },
    {
      href: "/admin/servicos",
      icon: Scissors,
      title: "Serviços",
      description: "Preços, duração e repasse dos serviços.",
    },
    {
      href: "/admin/maquinas",
      icon: Store,
      title: "Maquinas",
      description: "Catálogo visual e maquinas ativas.",
      badge: activeProducts ? `${activeProducts}` : undefined,
    },
    {
      href: "/admin/extras",
      icon: PackagePlus,
      title: "Extras",
      description: "Itens vendidos junto ao atendimento.",
    },
    {
      href: "/admin/avaliacoes",
      icon: MessageSquareText,
      title: "Avaliações",
      description: "Moderacao dos comentários do site.",
      badge: visibleReviews ? `${visibleReviews}` : undefined,
    },
    {
      href: "/admin/configuracoes",
      icon: Settings,
      title: "Configuracoes da barbearia",
      description: "WhatsApp, e-mail, Instagram e fotos da home.",
    },
    {
      href: "/admin/caixinhas",
      icon: PiggyBank,
      title: "Caixinhas dos barbeiros",
      description: "Resumo e detalhes das caixinhas registradas.",
    },
    {
      href: "/admin/perfil",
      icon: UserRound,
      title: "Configurar perfil",
      description: "Dados do admin, telefone e senha do painel.",
    },
  ];
  const routineOrder = [
    "/barber",
    "/admin/agenda",
    "/admin/barbeiros",
    "/admin/financeiro",
    "/admin/servicos",
    "/admin/extras",
    "/admin/maquinas",
    "/admin/caixinhas",
    "/admin/configuracoes",
    "/admin/avaliacoes",
    "/admin/perfil",
  ];
  const sortedEntries = [...entries].sort(
    (left, right) =>
      routineOrder.indexOf(left.href) - routineOrder.indexOf(right.href)
  ).filter((entry) => canAdminActAsBarber(shopId) || entry.href !== "/barber");

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-5 text-white sm:px-6 sm:py-8">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                Hoje na barbearia
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Agenda, equipe e dinheiro do dia em um lugar so.
              </p>
            </div>
            <AdminNotificationsBell notifications={appNotifications} />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <AdminMetric
              icon={<CalendarRange />}
              label="Atendimentos"
              value={`${todayAppointmentsCount}`}
              helper={`${completedTodayAppointments.length} concluídos · ${canceledTodayAppointments} cancelados`}
            />
            <AdminMetric
              icon={<UsersRound />}
              label="Barbeiros ativos"
              value={`${activeBarbers}`}
              helper={pendingInvites ? `${pendingInvites} convite(s)` : "equipe pronta"}
            />
            <AdminMetric
              icon={<DollarSign />}
              label="Faturado hoje"
              value={formatCurrency(todayRevenue)}
              helper="atendimentos concluídos"
              details={getPaymentBreakdownDetails(todayPaymentBreakdown)}
            />
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold text-white">Rotinas do admin</h2>
            <p className="max-w-sm text-base leading-7 text-zinc-400">
              Acesse quando precisar ajustar alguma parte da barbearia.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedEntries.map((entry) => (
              <DashboardEntryCard
                key={entry.href}
                href={entry.href}
                icon={entry.icon}
                title={entry.title}
                description={entry.description}
                badge={entry.badge}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
function AdminMetric({
  icon,
  label,
  value,
  helper,
  details = [],
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  details?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        <span
          data-admin-metric-icon
          className="h-4 w-4 shrink-0 text-[var(--brand-strong)] [&>svg]:h-4 [&>svg]:w-4"
        >
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </div>

      <p
        title={value}
        className="mt-3 min-w-0 truncate text-2xl font-black leading-none text-white tabular-nums"
      >
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-4 text-zinc-400">
        {helper}
      </p>
      {details.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="flex min-w-0 items-center justify-between gap-3 text-sm"
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
