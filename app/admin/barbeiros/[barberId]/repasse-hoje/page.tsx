import { getWeekRange } from "@/lib/financials";
import PayoutReport, {
  getPayoutRangeFromSearchParams,
  type PayoutSearchParams,
} from "../PayoutReport";

export const dynamic = "force-dynamic";

type AdminBarberRouteParams = {
  params: Promise<{ barberId: string }>;
  searchParams?: Promise<PayoutSearchParams>;
};

export default async function BarberTodayPayoutPage({
  params,
  searchParams,
}: AdminBarberRouteParams) {
  const { barberId } = await params;
  const range = getPayoutRangeFromSearchParams(
    (await searchParams) || {},
    getWeekRange()
  );

  return (
    <PayoutReport
      barberId={barberId}
      title="Repasse por periodo"
      description="Servicos e produtos concluidos no periodo selecionado, com comissao individual."
      range={range}
    />
  );
}
