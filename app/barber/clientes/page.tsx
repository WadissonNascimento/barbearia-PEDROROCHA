import BackLink from "@/components/ui/BackLink";
import PageHeader from "@/components/ui/PageHeader";
import { requireActiveBarber } from "../guard";
import { getBarberClientsDirectory } from "../data";
import ClientsDirectoryClient from "./ClientsDirectoryClient";

type SearchParams = {
  q?: string;
};

export default async function BarberClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { barber } = await requireActiveBarber();
  const params = await searchParams;

  const result = await getBarberClientsDirectory(
    barber.id,
    params.q || ""
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-white">
      <BackLink href="/barber" area="Painel" className="mb-5" />

      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        description="Busque clientes, veja frequência e abra o perfil completo de cada um."
        variant="plain"
      />

      <ClientsDirectoryClient clients={result.clients} search={result.search} />
    </div>
  );
}
