import { unstable_noStore as noStore } from "next/cache";
import { PiggyBank } from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import { requireActiveBarber } from "../guard";
import BarberTipForm from "./BarberTipForm";

export default async function BarberTipsPage() {
  noStore();

  const { barber } = await requireActiveBarber();
  const barberName = barber.name || "Barbeiro";

  return (
    <DashboardShell size="narrow">
      <section className="dashboard-panel p-4 sm:p-6">
        <div className="mb-5">
          <BackLink href="/barber" area="Painel" />
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
            <PiggyBank className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              Painel do barbeiro
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Anotar caixinha
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Registro rapido para {barberName}. A caixinha fica vinculada ao
              barbeiro logado e aparece no painel do admin.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <BarberTipForm />
        </div>
      </section>
    </DashboardShell>
  );
}
