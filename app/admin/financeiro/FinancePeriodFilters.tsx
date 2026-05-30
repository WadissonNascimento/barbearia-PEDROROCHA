"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PremiumDatePicker, PremiumSelect } from "@/components/ui/PremiumFilters";

type Period = "week" | "month" | "custom";

export default function FinancePeriodFilters({
  period,
  start,
  end,
}: {
  period: Period;
  start: string;
  end: string;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/admin/financeiro";
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({ period, start, end });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFilters({ period, start, end });
  }, [end, period, start]);

  function applyFilters(next: typeof filters) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (next.period === "week") {
      params.delete("period");
      params.delete("start");
      params.delete("end");
    } else {
      params.set("period", next.period);

      if (next.period === "custom") {
        if (next.start) params.set("start", next.start);
        else params.delete("start");

        if (next.end) params.set("end", next.end);
        else params.delete("end");
      } else {
        params.delete("start");
        params.delete("end");
      }
    }

    startTransition(() => {
      router.replace(
        params.toString() ? `${pathname}?${params.toString()}` : pathname,
        { scroll: false }
      );
    });
  }

  return (
    <form className="grid gap-3">
      <div className="grid gap-1.5 sm:grid-cols-[6.5rem_1fr] sm:items-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
          Período
        </p>
        <PremiumSelect
          name="period"
          value={filters.period}
          options={[
            { value: "week", label: "Esta semana" },
            { value: "month", label: "Este mês" },
            { value: "custom", label: "Escolher datas" },
          ]}
          onChange={(value) => {
            const next = {
              ...filters,
              period: value as Period,
            };

            setFilters(next);
            applyFilters(next);
          }}
        />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-[6.5rem_1fr] sm:items-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
          Datas
        </p>
        <div className="grid min-w-0 gap-2 min-[460px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[460px]:items-center">
          <PremiumDatePicker
            name="start"
            value={filters.start}
            onChange={(value) => {
              const next = {
                ...filters,
                start: value,
              };

              setFilters(next);
              if (next.period === "custom") {
                applyFilters(next);
              }
            }}
            disabled={filters.period !== "custom"}
          />
          <span className="text-xs text-zinc-500">até</span>
          <PremiumDatePicker
            name="end"
            value={filters.end}
            onChange={(value) => {
              const next = {
                ...filters,
                end: value,
              };

              setFilters(next);
              if (next.period === "custom") {
                applyFilters(next);
              }
            }}
            disabled={filters.period !== "custom"}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {isPending
          ? "Atualizando os números..."
          : filters.period === "custom"
          ? "As datas escolhidas atualizam o painel automaticamente."
          : "Troque o período para atualizar o painel sem recarregar a página inteira."}
      </p>
    </form>
  );
}
