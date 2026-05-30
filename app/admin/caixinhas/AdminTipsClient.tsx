"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackMessage from "@/components/FeedbackMessage";
import { formatCurrency } from "@/lib/utils";
import {
  getAdminBarberTipsAction,
  type AdminTipDetailItem,
  type AdminTipFilters,
  type AdminTipPeriod,
  type AdminTipSummaryItem,
} from "./actions";

type InitialFilters = Required<Pick<AdminTipFilters, "period" | "start" | "end">>;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminTipsClient({
  summaries,
  filters,
}: {
  summaries: AdminTipSummaryItem[];
  filters: InitialFilters;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/admin/caixinhas";
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localFilters, setLocalFilters] = useState(filters);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [details, setDetails] = useState<AdminTipDetailItem[]>([]);
  const [detailsPage, setDetailsPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const selectedBarber = useMemo(
    () => summaries.find((item) => item.barberId === selectedBarberId) || null,
    [selectedBarberId, summaries]
  );

  useEffect(() => {
    setLocalFilters(filters);
    setSelectedBarberId(null);
    setDetails([]);
    setDetailsPage(1);
    setHasNextPage(false);
    setDetailsError(null);
  }, [filters]);

  function applyFilters(next: InitialFilters) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("period", next.period);

    if (next.period === "custom") {
      params.set("start", next.start);
      params.set("end", next.end);
    } else {
      params.delete("start");
      params.delete("end");
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  async function loadDetails(barberId: string, page = 1, append = false) {
    setIsLoadingDetails(true);
    setDetailsError(null);

    const result = await getAdminBarberTipsAction({
      barberId,
      filters: localFilters,
      page,
    });

    if (!result.ok) {
      setDetailsError(result.message || "Nao foi possivel carregar as caixinhas.");
      setDetails([]);
      setHasNextPage(false);
      setIsLoadingDetails(false);
      return;
    }

    setDetails((current) => (append ? [...current, ...result.items] : result.items));
    setDetailsPage(result.page);
    setHasNextPage(result.hasNextPage);
    setIsLoadingDetails(false);
  }

  function toggleBarber(barberId: string) {
    if (selectedBarberId === barberId) {
      setSelectedBarberId(null);
      setDetails([]);
      setHasNextPage(false);
      return;
    }

    setSelectedBarberId(barberId);
    void loadDetails(barberId, 1, false);
  }

  return (
    <div className="mt-6 grid gap-5">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                Periodo
              </span>
              <select
                value={localFilters.period}
                onChange={(event) => {
                  const next = {
                    ...localFilters,
                    period: event.target.value as AdminTipPeriod,
                  };
                  setLocalFilters(next);
                  applyFilters(next);
                }}
                className="min-h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none focus:border-[var(--brand)]/50"
              >
                <option value="today">Hoje</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                Inicio
              </span>
              <input
                type="date"
                value={localFilters.start}
                disabled={localFilters.period !== "custom"}
                onChange={(event) => {
                  const next = { ...localFilters, start: event.target.value };
                  setLocalFilters(next);
                  if (next.period === "custom") applyFilters(next);
                }}
                className="min-h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none disabled:opacity-50 focus:border-[var(--brand)]/50"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                Fim
              </span>
              <input
                type="date"
                value={localFilters.end}
                disabled={localFilters.period !== "custom"}
                onChange={(event) => {
                  const next = { ...localFilters, end: event.target.value };
                  setLocalFilters(next);
                  if (next.period === "custom") applyFilters(next);
                }}
                className="min-h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none disabled:opacity-50 focus:border-[var(--brand)]/50"
              />
            </label>
          </div>

          <p className="text-xs text-zinc-500">
            {isPending ? "Atualizando..." : "Resumo carregado por periodo."}
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        {summaries.length === 0 ? (
          <EmptyState
            title="Nenhum barbeiro encontrado"
            description="Quando houver barbeiros ativos, os resumos de caixinha aparecem aqui."
          />
        ) : (
          summaries.map((summary) => {
            const isSelected = selectedBarberId === summary.barberId;

            return (
              <article
                key={summary.barberId}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              >
                <button
                  type="button"
                  onClick={() => toggleBarber(summary.barberId)}
                  className="flex w-full min-w-0 flex-col gap-3 p-4 text-left transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-white">
                      {summary.barberName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {summary.tipsCount} caixinha(s) registrada(s)
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-2 text-left sm:min-w-[18rem] sm:grid-cols-[1fr_auto] sm:items-center sm:text-right">
                    <div>
                      <p className="text-xl font-black text-[var(--brand-strong)]">
                        {formatCurrency(summary.totalAmount)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {summary.lastTip
                          ? `Ultima: ${formatCurrency(summary.lastTip.amount)} de ${summary.lastTip.clientName}`
                          : "Sem caixinhas no periodo"}
                      </p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                      {isSelected ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                </button>

                {isSelected ? (
                  <div className="border-t border-white/10 p-4">
                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Detalhes de {selectedBarber?.barberName}
                    </h2>

                    {detailsError ? (
                      <div className="mt-3">
                        <FeedbackMessage message={detailsError} tone="error" />
                      </div>
                    ) : null}

                    {isLoadingDetails && details.length === 0 ? (
                      <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando caixinhas...
                      </div>
                    ) : details.length === 0 ? (
                      <div className="mt-4">
                        <EmptyState
                          title="Sem caixinhas nesse periodo"
                          description="Troque o filtro ou escolha outro barbeiro."
                        />
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-2">
                        {details.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-black/25 p-3"
                          >
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="break-words text-base font-bold text-white">
                                  {item.clientName}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {formatDateTime(item.createdAt)}
                                </p>
                              </div>
                              <p className="shrink-0 text-lg font-black text-[var(--brand-strong)]">
                                {formatCurrency(item.amount)}
                              </p>
                            </div>
                            {item.note ? (
                              <p className="mt-3 whitespace-pre-wrap break-words border-t border-white/10 pt-3 text-sm leading-6 text-zinc-300">
                                {item.note}
                              </p>
                            ) : null}
                          </div>
                        ))}

                        {hasNextPage ? (
                          <button
                            type="button"
                            disabled={isLoadingDetails || !selectedBarberId}
                            onClick={() =>
                              selectedBarberId
                                ? void loadDetails(selectedBarberId, detailsPage + 1, true)
                                : undefined
                            }
                            className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isLoadingDetails ? "Carregando..." : "Carregar mais"}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
