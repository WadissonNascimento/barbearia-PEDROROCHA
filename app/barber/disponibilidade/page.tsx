import BackLink from "@/components/ui/BackLink";
import PageHeader from "@/components/ui/PageHeader";
import { AvailabilitySection } from "../_components/AvailabilitySection";
import { getBarberAvailabilityData } from "../data";
import { requireActiveBarber } from "../guard";

export default async function BarberAvailabilityPage({
}: {
  searchParams?: { feedback?: string; tone?: string };
}) {
  const { barber } = await requireActiveBarber();
  const dashboard = await getBarberAvailabilityData(barber.id);
  const barberName = barber.name || "barbeiro";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-white">
      <BackLink href="/barber" area="Painel" className="mb-5" />

      <PageHeader
        eyebrow="Sua escala"
        title={`Disponibilidade de ${barberName}`}
        variant="plain"
      />

      <div className="mt-6">
        <AvailabilitySection
          availabilities={dashboard.availabilities}
          blocks={dashboard.blocks}
          recurringBlocks={dashboard.recurringBlocks}
        />
      </div>
    </div>
  );
}
