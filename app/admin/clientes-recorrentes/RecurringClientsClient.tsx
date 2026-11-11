"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ui/StatusBadge";
import { cancelAdminRecurringAppointmentSeriesAction } from "@/app/admin/agenda/actions";

type Occurrence = {
  date: string;
  dateValue: string;
  time: string;
};

export type RecurringClientItem = {
  id: string;
  status: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  registeredCustomer: boolean;
  barberId: string;
  barberName: string;
  serviceNames: string[];
  frequency: string;
  frequencyCode: string;
  time: string;
  startDate: string;
  endDate: string | null;
  unlimited: boolean;
  totalOccurrences: number;
  upcomingOccurrences: number;
  nextOccurrence: Occurrence | null;
  lastOccurrence: Occurrence | null;
  agendaDate: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatStatus(value: string) {
  return value === "ACTIVE" ? "Ativa" : "Cancelada";
}

export default function RecurringClientsClient({
  items,
}: {
  items: RecurringClientItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return normalizeSearch(
        [
          item.customerName,
          item.customerPhone,
          item.customerEmail,
          item.barberName,
          item.frequency,
          ...item.serviceNames,
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(normalizedQuery);
    });
  }, [items, query, statusFilter]);

  const activeCount = items.filter((item) => item.status === "ACTIVE").length;
  const cancelledCount = items.filter((item) => item.status !== "ACTIVE").length;
  const upcomingCount = items.reduce(
    (total, item) => total + item.upcomingOccurrences,
    0
  );

  function cancelSeries(item: RecurringClientItem) {
    if (isPending || item.status !== "ACTIVE") {
      return;
    }

    const confirmed = window.confirm(
      `Cancelar todas as ocorrências futuras de ${item.customerName}?`
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("seriesId", item.id);
      formData.set("fromDate", new Date().toISOString());
      formData.set("cancellationReason", "Série cancelada pelo admin.");

      try {
        const result = await cancelAdminRecurringAppointmentSeriesAction(formData);

        if (!result.ok) {
          setFeedback(result.message);
          return;
        }

        setFeedback("Série cancelada com sucesso.");
        router.refresh();
      } catch {
        setFeedback("Não foi possível cancelar a série agora. Tente novamente.");
      }
    });
  }

  return (
    <section className="mt-7 max-w-full rounded-3xl border border-white/10 bg-black/20 p-3 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-3">
        <SummaryCard
          icon={<CheckCircle2 />}
          label="Séries ativas"
          value={activeCount}
          tone="success"
        />
        <SummaryCard
          icon={<CalendarDays />}
          label="Próximos atendimentos"
          value={upcomingCount}
          tone="info"
        />
        <SummaryCard
          icon={<XCircle />}
          label="Séries canceladas"
          value={cancelledCount}
          tone="danger"
        />
      </div>

      <div className="mt-5 flex min-w-0 flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            Gerenciamento
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Todas as séries
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Busque por cliente, telefone, barbeiro ou serviço.
          </p>
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_160px] lg:min-w-[520px]">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 focus-within:border-[var(--brand)]/50">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-11 rounded-2xl border border-white/10 bg-[#090909] px-3 text-sm font-bold text-white outline-none focus:border-[var(--brand)]/50"
          >
            <option value="ACTIVE">Ativas</option>
            <option value="ALL">Todas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          {feedback}
        </div>
      ) : null}

      <div className="mt-4 grid max-w-full min-w-0 gap-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
            Nenhuma série encontrada com esses filtros.
          </div>
        ) : (
          filteredItems.map((item) => (
            <RecurringClientCard
              key={item.id}
              item={item}
              isPending={isPending}
              onCancel={() => cancelSeries(item)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "success" | "info" | "danger";
}) {
  const toneClass = {
    success: "text-emerald-300",
    info: "text-sky-300",
    danger: "text-rose-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] ${toneClass}`}>
        <span className="h-4 w-4">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function RecurringClientCard({
  item,
  isPending,
  onCancel,
}: {
  item: RecurringClientItem;
  isPending: boolean;
  onCancel: () => void;
}) {
  const isActive = item.status === "ACTIVE";
  const agendaHref = `/admin/agenda?dateFrom=${item.agendaDate}&dateTo=${item.agendaDate}&barberId=${item.barberId}`;
  const occurrence = item.nextOccurrence;

  return (
    <article className="max-w-full overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-xl font-black leading-tight text-white">
              {item.customerName}
            </h3>
            <StatusBadge variant={isActive ? "success" : "danger"}>
              {formatStatus(item.status)}
            </StatusBadge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              {item.barberName}
            </span>
            {item.customerPhone ? <span>{item.customerPhone}</span> : null}
            {item.registeredCustomer ? (
              <span className="inline-flex items-center gap-1 text-emerald-200">
                <CircleUserRound className="h-3.5 w-3.5" aria-hidden="true" />
                Cliente cadastrado
              </span>
            ) : (
              <span>Cliente sem conta</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={agendaHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Ver na agenda
          </Link>
          {isActive ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-wait disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Cancelando..." : "Cancelar série"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoItem label="Frequência" value={`${item.frequency} · ${item.time}`} />
        <InfoItem
          label={isActive ? "Próximo atendimento" : "Último atendimento"}
          value={occurrence ? `${formatDate(occurrence.date)} às ${occurrence.time}` : "Não gerado"}
          icon={<Clock3 />}
        />
        <InfoItem
          label="Período"
          value={item.unlimited ? `Desde ${item.startDate} · sem limite` : `${item.startDate} até ${item.endDate || "-"}`}
        />
        <InfoItem
          label="Ocorrências"
          value={`${item.upcomingOccurrences} futuras · ${item.totalOccurrences} geradas`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
        {item.serviceNames.map((serviceName) => (
          <span key={serviceName} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
            {serviceName}
          </span>
        ))}
      </div>
    </article>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 flex min-w-0 items-center gap-1.5 break-words text-sm font-bold text-zinc-200">
        {icon ? <span className="shrink-0 text-[var(--brand-strong)]">{icon}</span> : null}
        {value}
      </p>
    </div>
  );
}
