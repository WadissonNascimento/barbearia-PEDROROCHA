import { redirect } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import PageHeader from "@/components/ui/PageHeader";
import PayoutAppointmentCard from "./PayoutAppointmentCard";
import PayoutFilters from "./PayoutFilters";
import { normalizeAppointmentStatus } from "@/lib/appointmentStatus";
import { getBarberTipRows } from "@/lib/barberTips";
import { getManualFitInCustomerDisplay } from "@/lib/manualFitIn";
import { toMoneyNumber, type MoneyValue } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  formatScheduleTime,
  getScheduleDayRange,
  getScheduleDateValue,
} from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

function formatCommission(type: string, value: MoneyValue) {
  const numericValue = toMoneyNumber(value);
  return type === "FIXED" ? formatCurrency(numericValue) : `${numericValue}%`;
}

function getPayoutCustomerName(appointment: {
  isManualFitIn: boolean;
  notes: string | null;
  customer: {
    name: string | null;
    phone?: string | null;
    email?: string | null;
  };
}) {
  if (!appointment.isManualFitIn) {
    return appointment.customer.name || "Cliente";
  }

  return getManualFitInCustomerDisplay({
    notes: appointment.notes,
    fallbackCustomer: appointment.customer,
  }).name;
}

type PayoutRange = {
  start: Date;
  end: Date;
};

export type PayoutSearchParams = {
  start?: string;
  end?: string;
};

function isDateValue(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function getPayoutRangeFromSearchParams(
  searchParams: PayoutSearchParams,
  fallback: PayoutRange
): PayoutRange {
  const startValue = isDateValue(searchParams.start) ? searchParams.start! : "";
  const endValue = isDateValue(searchParams.end) ? searchParams.end! : "";
  const startRange = startValue ? getScheduleDayRange(startValue) : null;
  const endRange = endValue ? getScheduleDayRange(endValue) : null;

  return {
    start: startRange?.start || fallback.start,
    end: endRange?.end || fallback.end,
  };
}

function formatDateInputValue(date: Date) {
  return getScheduleDateValue(date);
}

export default async function PayoutReport({
  barberId,
  title,
  description,
  range,
}: {
  barberId: string;
  title: string;
  description: string;
  range: {
    start: Date;
    end: Date;
  };
}) {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const barber = await prisma.user.findFirst({
    where: {
      shopId,
      id: barberId,
      role: "BARBER",
    },
  });

  if (!barber) redirect("/admin/barbeiros");

  const [appointments, tips] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        shopId,
        barberId: barber.id,
        date: {
          gte: range.start,
          lte: range.end,
        },
        status: {
          in: ["COMPLETED", "DONE"],
        },
      },
      include: {
        customer: true,
        items: true,
        services: true,
      },
      orderBy: {
        date: "asc",
      },
    }),
    getBarberTipRows({
      barberId: barber.id,
      range,
    }),
  ]);

  const serviceRows = appointments.flatMap((appointment) =>
    [...appointment.services]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((service) => ({
        id: service.id,
        appointmentId: appointment.id,
        time: formatScheduleTime(appointment.date),
        customerName: getPayoutCustomerName(appointment),
        name: service.nameSnapshot,
        gross: toMoneyNumber(service.priceSnapshot),
        commission: formatCommission(
          service.commissionTypeSnapshot,
          service.commissionValueSnapshot
        ),
        payout: toMoneyNumber(service.barberPayoutSnapshot),
        type: "Serviço",
      }))
  );

  const productRows = appointments.flatMap((appointment) =>
    appointment.items
      .filter((item) => item.isDelivered)
      .map((item) => ({
        id: item.id,
        appointmentId: appointment.id,
        time: formatScheduleTime(appointment.date),
        customerName: getPayoutCustomerName(appointment),
        name: `${item.productNameSnapshot} x${item.quantity}`,
        gross: toMoneyNumber(item.subtotal),
        commission: formatCommission(item.commissionTypeSnapshot, item.commissionValueSnapshot),
        payout: toMoneyNumber(item.barberPayoutSnapshot),
        type: "Produto",
      }))
  );

  const tipRows = tips.map((tip) => ({
    id: tip.id,
    appointmentId: tip.id,
    time: formatScheduleTime(tip.createdAt),
    customerName: tip.clientName,
    name: tip.note ? `Caixinha - ${tip.note}` : "Caixinha",
    gross: tip.amount,
    commission: "100%",
    payout: tip.amount,
    type: "Caixinha",
  }));

  const appointmentRows = appointments.map((appointment) => {
    const appointmentServiceRows = serviceRows.filter(
      (row) => row.appointmentId === appointment.id
    );
    const appointmentProductRows = productRows.filter(
      (row) => row.appointmentId === appointment.id
    );
    const appointmentItems = [...appointmentServiceRows, ...appointmentProductRows];

    return {
      id: appointment.id,
      time: formatScheduleTime(appointment.date),
      customerName: getPayoutCustomerName(appointment),
      gross: appointmentItems.reduce((sum, row) => sum + row.gross, 0),
      payout: appointmentItems.reduce((sum, row) => sum + row.payout, 0),
      servicesPayout: appointmentServiceRows.reduce((sum, row) => sum + row.payout, 0),
      extrasPayout: appointmentProductRows.reduce((sum, row) => sum + row.payout, 0),
      items: appointmentItems,
    };
  });

  const rows = [...serviceRows, ...productRows, ...tipRows];
  const totalGross = rows.reduce((sum, row) => sum + row.gross, 0);
  const totalPayout = rows.reduce((sum, row) => sum + row.payout, 0);
  const totalServicesPayout = serviceRows.reduce((sum, row) => sum + row.payout, 0);
  const totalExtrasPayout = productRows.reduce((sum, row) => sum + row.payout, 0);
  const totalTipsPayout = tipRows.reduce((sum, row) => sum + row.payout, 0);
  const startValue = formatDateInputValue(range.start);
  const endValue = formatDateInputValue(range.end);

  return (
    <DashboardShell>
      <PageHeader
        eyebrow={barber.name || "Barbeiro"}
        title={title}
        description={description}
        actions={
          <BackLink href={`/admin/barbeiros/${barber.id}`} area="Perfil" />
        }
      />

      <PayoutFilters start={startValue} end={endValue} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Total vendido"
          value={formatCurrency(totalGross)}
          helper="Valor bruto do periodo"
        />
        <SummaryCard
          label="Repasse do barbeiro"
          value={formatCurrency(totalPayout)}
          details={[
            { label: "Servicos", value: formatCurrency(totalServicesPayout) },
            { label: "Extras", value: formatCurrency(totalExtrasPayout) },
            { label: "Caixinhas", value: formatCurrency(totalTipsPayout) },
          ]}
          featured
        />
      </div>

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-400">
            Nenhum atendimento concluído nesse período.
          </div>
        ) : (
          <>
            {appointmentRows.map((appointment) => (
              <PayoutAppointmentCard key={appointment.id} appointment={appointment} />
            ))}
            {tipRows.map((row) => (
              <article
                key={`${row.type}-${row.id}`}
                className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,40,61,0.72),rgba(13,18,30,0.98))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-sky-300">
                      {row.type} - {row.time}
                    </p>
                    <p className="mt-2 font-semibold text-white">{row.name}</p>
                    <p className="mt-1 truncate text-sm text-zinc-400">{row.customerName}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-300">
                    {row.commission}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <InfoBox label="Valor" value={formatCurrency(row.gross)} />
                  <InfoBox label="Ganho barbeiro" value={formatCurrency(row.payout)} />
                </div>
              </article>
            ))}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  details,
  featured = false,
}: {
  label: string;
  value: string;
  helper?: string;
  details?: Array<{ label: string; value: string }>;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)] ${
        featured
          ? "border-sky-400/40 bg-[linear-gradient(180deg,rgba(14,165,233,0.22),rgba(13,18,30,0.98))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(28,40,61,0.72),rgba(13,18,30,0.98))]"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-sky-300">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-zinc-400">{helper}</p> : null}
      {details?.length ? (
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs text-zinc-300">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-center justify-between gap-3">
              <span>{detail.label}</span>
              <strong className="font-semibold text-white">{detail.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
