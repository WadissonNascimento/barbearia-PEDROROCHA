import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import AdminHomeImagesClient from "../home/AdminHomeImagesClient";
import ShopSettingsClient from "./ShopSettingsClient";

export default async function AdminShopSettingsPage() {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const [shop, images] = await Promise.all([
    prisma.shop.findUnique({
      where: {
        id: shopId,
      },
      select: {
        whatsappNumber: true,
        instagramUrl: true,
        emailSettings: {
          select: {
            replyToEmail: true,
          },
        },
      },
    }),
    prisma.homeImage.findMany({
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
    }),
  ]);

  if (!shop) {
    redirect("/logout");
  }

  return (
    <DashboardShell size="wide">
      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Configuracoes
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Configuracoes da barbearia
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Atualize somente contato publico e as fotos da home. As alteracoes
            ficam isoladas nesta barbearia.
          </p>
        </div>

        <ShopSettingsClient shop={shop} />

        <div className="mt-6 border-t border-white/10 pt-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Home
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Fotos da home
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
              Gerencie ate 5 fotos principais da pagina inicial desta
              barbearia.
            </p>
          </div>

          <AdminHomeImagesClient images={images} />
        </div>
      </section>
    </DashboardShell>
  );
}
