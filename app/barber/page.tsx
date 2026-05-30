import BarberTodayDashboard from "./_components/BarberTodayDashboard";
import { getBarberTodayDashboardData } from "./data";
import { requireActiveBarber } from "./guard";

export default async function BarberPage() {
  const { barber } = await requireActiveBarber();
  const dashboard = await getBarberTodayDashboardData(barber.id);
  const barberName = barber.name || "Barbeiro";
  const shopName = barber.shop.name;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-5 text-white sm:px-6 sm:py-8">
        <div className="mb-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand-strong)]">
              Painel do barbeiro
            </p>
            <p className="mt-1 truncate text-sm text-zinc-400">
              {barberName}
            </p>
          </div>
        </div>

        <BarberTodayDashboard
          barberName={barberName}
          shopName={shopName}
          summary={dashboard.summary}
          walkInServices={dashboard.walkInServices}
          walkInExtras={dashboard.walkInExtras}
          clients={dashboard.clients}
          appNotifications={dashboard.appNotifications}
        />
      </div>
    </div>
  );
}
