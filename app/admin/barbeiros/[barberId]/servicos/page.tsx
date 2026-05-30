import { redirect } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import PageHeader from "@/components/ui/PageHeader";
import { toMoneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import ServiceCommissionListClient from "./ServiceCommissionListClient";

export const dynamic = "force-dynamic";

type AdminBarberRouteParams = {
  params: Promise<{ barberId: string }>;
};

export default async function BarberServicesPage({
  params,
}: AdminBarberRouteParams) {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });
  const { barberId } = await params;

  const barber = await prisma.user.findFirst({
    where: {
      shopId,
      id: barberId,
      role: "BARBER",
    },
  });

  if (!barber) redirect("/admin/barbeiros");

  const services = await prisma.service.findMany({
    where: {
      shopId,
      OR: [{ barberId: barber.id }, { barberId: null }],
    },
    include: {
      barberCommissions: {
        where: {
          barberId: barber.id,
        },
        take: 1,
      },
    },
    orderBy: [
      {
        barberId: "desc",
      },
      {
        name: "asc",
      },
    ],
  });

  return (
    <DashboardShell>
      <PageHeader
        eyebrow={barber.name || "Barbeiro"}
        title="Serviços"
        description="Serviços que este barbeiro pode executar e suas comissões individuais."
        actions={<BackLink href={`/admin/barbeiros/${barber.id}`} area="Perfil" />}
      />

      <ServiceCommissionListClient
        barberId={barber.id}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          price: toMoneyNumber(service.price),
          duration: service.duration,
          barberId: service.barberId,
          commissionType: service.commissionType,
          commissionValue: toMoneyNumber(service.commissionValue),
          customCommission: service.barberCommissions[0]
            ? {
                commissionType: service.barberCommissions[0].commissionType,
                commissionValue: toMoneyNumber(service.barberCommissions[0].commissionValue),
              }
            : null,
        }))}
      />
    </DashboardShell>
  );
}
