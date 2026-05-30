import { unstable_noStore as noStore } from "next/cache";
import BackLink from "@/components/ui/BackLink";
import PageHeader from "@/components/ui/PageHeader";
import { AppointmentsSection } from "../_components/AppointmentsSection";
import { getBarberAgendaData } from "../data";
import { requireActiveBarber } from "../guard";

type SearchParams = {
  view?: "day" | "today" | "upcoming" | "all";
  status?: string;
  date?: string;
  feedback?: string;
  tone?: string;
};

type BarberAgendaPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function BarberAgendaPage({
  searchParams,
}: BarberAgendaPageProps) {
  noStore();

  const { barber } = await requireActiveBarber();
  const filters = await searchParams;
  const agenda = await getBarberAgendaData(barber.id, filters);
  const barberName = barber.name || "Barbeiro";
  const shopName = barber.shop.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-white">
      <BackLink href="/barber" area="Painel" className="mb-5" />

      <PageHeader
        title={`Agenda de ${barberName}`}
        description="Horários, clientes e status dos atendimentos."
        variant="plain"
      />

      <div className="mt-6">
        <AppointmentsSection
          appointments={agenda.appointments}
          blocks={agenda.blocks}
          services={agenda.services}
          extras={agenda.extras}
          filters={agenda.filters}
          barberName={barberName}
          shopName={shopName}
        />
      </div>
    </div>
  );
}
