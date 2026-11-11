import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import PageHeader from "@/components/ui/PageHeader";
import { toMoneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getRecurringSeriesForShop } from "@/lib/recurringSeries";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { sortServicesForDisplay } from "@/lib/servicePresentation";
import AdminRecurringAppointmentButton from "../agenda/AdminRecurringAppointmentButton";
import RecurringClientsClient from "./RecurringClientsClient";

export default async function RecurringClientsPage() {
  const { shopId } = await requireTenantSession({ roles: SHOP_ADMIN_ROLES });
  const [series, barbers, services] = await Promise.all([
    getRecurringSeriesForShop(shopId),
    prisma.user.findMany({ where: { shopId, role: "BARBER", isActive: true }, select: { id: true, name: true, email: true, image: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { shopId, isActive: true }, select: { id: true, name: true, price: true, duration: true, barberId: true }, orderBy: { name: "asc" } }),
  ]);
  return <DashboardShell size="wide"><div className="mb-5"><BackLink href="/admin" area="Admin" /></div><PageHeader eyebrow="Clientes fixos" title="Clientes recorrentes" description="Acompanhe as próximas visitas e ajuste cada horário ou toda a recorrência em um só lugar." actions={<AdminRecurringAppointmentButton barbers={barbers} customers={[]} services={sortServicesForDisplay(services).map((service) => ({ ...service, price: toMoneyNumber(service.price) }))} />} /><RecurringClientsClient series={series} /></DashboardShell>;
}
