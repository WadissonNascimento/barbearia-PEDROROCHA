"use client";

import { useState } from "react";
import { DollarSign, Scissors, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type PayoutAppointment = {
  id: string;
  time: string;
  customerName: string;
  gross: number;
  payout: number;
  servicesPayout: number;
  extrasPayout: number;
  items: Array<{
    id: string;
    name: string;
    gross: number;
    payout: number;
    commission: string;
    type: string;
  }>;
};

export default function PayoutAppointmentCard({
  appointment,
}: {
  appointment: PayoutAppointment;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => setIsExpanded((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setIsExpanded((current) => !current);
        }
      }}
      className="cursor-pointer overflow-hidden rounded-[22px] border border-white/10 bg-black/25 p-3.5 shadow-[0_18px_44px_rgba(0,0,0,0.16)] transition hover:border-[var(--brand)]/35 hover:bg-white/[0.035]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            Atendimento
          </p>
          <p className="mt-1 text-[26px] font-black leading-none text-white">
            {appointment.time}
          </p>
          <p className="mt-2 truncate text-base font-bold text-white">
            {appointment.customerName}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
            {appointment.items.map((item) => item.name).join(", ") || "Atendimento"}
          </p>
        </div>

        <div className="relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-emerald-300/70" />
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200/80">
            Repasse
          </p>
          <p className="mt-0.5 text-base font-black leading-none text-white">
            {formatCurrency(appointment.payout)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <BreakdownPill
          icon={<Scissors />}
          label="Servicos"
          value={formatCurrency(appointment.servicesPayout)}
        />
        <BreakdownPill
          icon={<ShoppingBag />}
          label="Extras"
          value={formatCurrency(appointment.extrasPayout)}
        />
        <BreakdownPill
          icon={<DollarSign />}
          label="Vendido"
          value={formatCurrency(appointment.gross)}
        />
      </div>

      {isExpanded ? (
        <div
          className="mt-3 space-y-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Itens do atendimento
            </p>
            <div className="mt-2 space-y-1.5">
              {appointment.items.map((item) => (
                <FinanceLine
                  key={`${item.type}-${item.id}`}
                  label={item.name}
                  value={formatCurrency(item.payout)}
                  helper={`${item.type} - ${formatCurrency(item.gross)} vendido - ${item.commission}`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function BreakdownPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        <span className="text-[var(--brand-strong)] [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function FinanceLine({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{label}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{helper}</p>
      </div>
      <p className="shrink-0 text-sm font-black text-[var(--brand-strong)]">
        {value}
      </p>
    </div>
  );
}
