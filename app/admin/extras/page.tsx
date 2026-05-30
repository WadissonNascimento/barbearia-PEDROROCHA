import { prisma } from "@/lib/prisma";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { normalizeProductImageUrl } from "@/lib/extraProductImages";
import { toMoneyNumber } from "@/lib/money";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import AdminExtrasClient from "./AdminExtrasClient";

export default async function AdminExtrasPage() {
  await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const extras = await prisma.extraProduct.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <DashboardShell size="wide">
      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Painel admin
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Extras
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Bebidas e itens vendidos junto ao atendimento.
          </p>
        </div>

        <AdminExtrasClient
          extras={extras.map((extra) => ({
            ...extra,
            price: toMoneyNumber(extra.price),
            commissionValue: toMoneyNumber(extra.commissionValue),
            imageUrl: normalizeProductImageUrl(extra.imageUrl),
          }))}
        />
      </section>
    </DashboardShell>
  );
}
