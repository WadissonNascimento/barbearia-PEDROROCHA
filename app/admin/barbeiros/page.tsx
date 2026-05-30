import { prisma } from "@/lib/prisma";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { readPageFeedback } from "@/lib/pageFeedback";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import AdminBarbersClient from "./AdminBarbersClient";

export default async function AdminBarbersPage({
  searchParams,
}: {
  searchParams?: Promise<{ feedback?: string; tone?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const now = new Date();
  const [barbers, pendingBarbers, shop] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "BARBER",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        barberAppointments: true,
      },
    }),
    prisma.pendingRegistration.findMany({
      where: {
        role: "BARBER",
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.shop.findUnique({
      where: { id: shopId },
      select: { barberLimit: true },
    }),
  ]);

  const feedback = readPageFeedback(resolvedSearchParams);
  const activeBarberCount = barbers.filter((barber) => barber.isActive).length;
  const usedBarberSlots = activeBarberCount + pendingBarbers.length;

  return (
    <DashboardShell>
      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Painel admin
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Gerenciamento
          </h1>
        </div>

        <AdminBarbersClient
          barbers={barbers}
          pendingBarbers={pendingBarbers}
          barberLimit={shop?.barberLimit ?? null}
          usedBarberSlots={usedBarberSlots}
          initialFeedback={feedback}
        />
      </section>
    </DashboardShell>
  );
}
