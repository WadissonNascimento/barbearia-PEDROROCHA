import { prisma } from "@/lib/prisma";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import AdminHomeImagesClient from "./AdminHomeImagesClient";

export default async function AdminHomeImagesPage() {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const images = await prisma.homeImage.findMany({
    where: {
      shopId,
      isActive: true,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      position: true,
    },
    take: 5,
  });

  return (
    <DashboardShell size="wide">
      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Aparencia
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Fotos da home
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Gerencie as imagens principais exibidas na pagina inicial.
          </p>
        </div>

        <AdminHomeImagesClient images={images} />
      </section>
    </DashboardShell>
  );
}
