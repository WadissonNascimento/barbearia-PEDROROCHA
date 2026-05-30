import { getActiveBarberForSession } from "@/lib/barberAccess";
import {
  BARBER_ROLES,
  requireTenantSession,
  SHOP_ADMIN_ROLES,
} from "@/lib/tenantSession";
import { redirect } from "next/navigation";

export async function requireActiveBarber() {
  const { session } = await requireTenantSession({
    roles: [...BARBER_ROLES, ...SHOP_ADMIN_ROLES],
  });

  const activeBarber = await getActiveBarberForSession(session.user);

  if (!activeBarber) {
    redirect("/login");
  }

  return {
    session,
    barber: activeBarber,
  };
}
