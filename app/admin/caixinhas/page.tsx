import { unstable_noStore as noStore } from "next/cache";
import { PiggyBank } from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { formatCurrency } from "@/lib/utils";
import {
  getAdminTipsSummaryAction,
  type AdminTipPeriod,
} from "./actions";
import AdminTipsClient from "./AdminTipsClient";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

type SearchParams = {
  period?: AdminTipPeriod;
  start?: string;
  end?: string;
};

type AdminTipsPageProps = {
  searchParams: Promise<SearchParams>;
};

function getTotalAmount(
  summaries: Awaited<ReturnType<typeof getAdminTipsSummaryAction>>["summaries"]
) {
  return summaries.reduce((sum, item) => sum + item.totalAmount, 0);
}

function getTipsCount(
  summaries: Awaited<ReturnType<typeof getAdminTipsSummaryAction>>["summaries"]
) {
  return summaries.reduce((sum, item) => sum + item.tipsCount, 0);
}

export default async function AdminTipsPage({ searchParams }: AdminTipsPageProps) {
  noStore();

  await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const filters = await searchParams;
  const data = await getAdminTipsSummaryAction(filters);
  const totalAmount = getTotalAmount(data.summaries);
  const tipsCount = getTipsCount(data.summaries);

  return (
    <DashboardShell size="wide" className="min-w-0 max-w-full overflow-hidden">
      <section className="dashboard-panel max-w-full p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
            <PiggyBank className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              Painel admin
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Caixinhas dos barbeiros
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Acompanhe as caixinhas registradas pelos barbeiros sem misturar com
              repasses, comissoes ou financeiro da casa.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <AdminTipMetric label="Total no periodo" value={formatCurrency(totalAmount)} />
          <AdminTipMetric label="Registros" value={`${tipsCount}`} />
          <AdminTipMetric label="Barbeiros" value={`${data.summaries.length}`} />
        </div>

        <AdminTipsClient summaries={data.summaries} filters={data.filters} />
      </section>
    </DashboardShell>
  );
}

function AdminTipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}
