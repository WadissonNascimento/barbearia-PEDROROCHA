import {
  buildAgendaCsv,
  getAdminAgendaReport,
  type AdminAgendaFilters,
} from "@/lib/adminReports";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { getTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

function getFilename() {
  const today = new Date().toISOString().slice(0, 10);
  return `agenda-relatorio-${today}.csv`;
}

export async function GET(request: Request) {
  const tenantSession = await getTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  if (!tenantSession) {
    logSecurityEvent("access_denied", { route: "/admin/agenda/export" });
    return new Response("Nao autenticado.", { status: 401 });
  }

  const rateLimit = await enforceRateLimit({
    scope: "admin:agenda_export",
    identifier: tenantSession.user.id,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return new Response("Muitas exportacoes. Aguarde e tente novamente.", {
      status: 429,
    });
  }

  const { searchParams } = new URL(request.url);

  const filters: AdminAgendaFilters = {
    shopId: tenantSession.shopId,
    barberId: searchParams.get("barberId") || "",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    status: searchParams.get("status") || "",
  };

  const { appointments } = await getAdminAgendaReport(filters);
  const csv = `\uFEFF${buildAgendaCsv(appointments)}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${getFilename()}"`,
    },
  });
}
