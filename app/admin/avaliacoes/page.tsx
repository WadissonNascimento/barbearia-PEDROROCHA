import { prisma } from "@/lib/prisma";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import AdminReviewsClient from "./AdminReviewsClient";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

export default async function AdminReviewsPage() {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const reviews = await prisma.review.findMany({
    where: {
      shopId,
    },
    include: {
      customer: {
        select: {
          name: true,
          email: true,
        },
      },
      barber: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <DashboardShell>
      <section className="dashboard-panel p-4 sm:p-5">
        <div className="border-b border-white/10 pb-5">
          <BackLink href="/admin" area="Admin" />

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Painel admin
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Avaliações</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Controle os comentários exibidos no site sem alterar os atendimentos.
          </p>
        </div>

        <AdminReviewsClient reviews={reviews} />
      </section>
    </DashboardShell>
  );
}
