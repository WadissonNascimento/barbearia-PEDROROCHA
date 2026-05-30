import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, requireTenantSession } from "@/lib/tenantSession";
import DashboardShell from "@/components/ui/DashboardShell";
import CustomerNotificationCard from "./CustomerNotificationCard";

export default async function CustomerNotificationsPage() {
  noStore();

  const { session, shopId } = await requireTenantSession({
    roles: CUSTOMER_ROLES,
  });

  const notifications = await prisma.appNotification.findMany({
    where: {
      shopId,
      recipientUserId: session.user.id,
    },
    select: {
      id: true,
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
    take: 30,
  });

  const unreadCount = notifications.filter(
    (notification) => !notification.readAt
  ).length;

  return (
    <DashboardShell>
      <section className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--brand-strong)]">
          Central do cliente
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="break-words text-3xl font-bold text-white">
              Notificações
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Acompanhe seus agendamentos, lembretes, cancelamentos e avaliações.
            </p>
          </div>
          {unreadCount > 0 ? (
            <span className="shrink-0 rounded-full border border-[var(--brand-strong)]/35 bg-[var(--brand-muted)] px-3 py-1.5 text-xs font-black text-[var(--brand-strong)]">
              {unreadCount} nova(s)
            </span>
          ) : null}
        </div>
      </section>

      {notifications.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-zinc-400">
          Nenhuma notificação para agora.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <CustomerNotificationCard
              key={notification.id}
              notification={notification}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
