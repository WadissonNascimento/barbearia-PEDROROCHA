import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/lib/money";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import AdminServicesClient from "./AdminServicesClient";

export default async function AdminServicosPage() {
  await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const services = await prisma.service.findMany({
    include: {
      barber: true,
    },
    orderBy: [{ barberId: "asc" }, { createdAt: "desc" }],
  });

  const serializedServices = services.map((service) => ({
    ...service,
    price: toMoneyNumber(service.price),
    commissionValue: toMoneyNumber(service.commissionValue),
  }));
  const globalServices = serializedServices.filter((service) => service.barberId === null);
  const barberServices = serializedServices.filter((service) => service.barberId !== null);
  const barbers = await prisma.user.findMany({
    where: {
      role: "BARBER",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return (
    <DashboardShell size="wide">
      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Painel admin
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Serviços e comissões
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Controle serviços gerais, serviços exclusivos e percentuais de repasse.
          </p>
        </div>

        <AdminServicesClient
          globalServices={globalServices}
          barberServices={barberServices}
          barbers={barbers}
        />
      </section>
    </DashboardShell>
  );
}
