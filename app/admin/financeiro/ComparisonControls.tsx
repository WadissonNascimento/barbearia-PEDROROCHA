"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PremiumDatePicker, PremiumSelect } from "@/components/ui/PremiumFilters";

type ComparisonControlsProps = {
  period: string;
  start: string;
  end: string;
  historyStart: string;
  historyEnd: string;
  compareMode: "auto" | "custom";
  compareStart: string;
  compareEnd: string;
};

export default function ComparisonControls({
  period,
  start,
  end,
  historyStart,
  historyEnd,
  compareMode,
  compareStart,
  compareEnd,
}: ComparisonControlsProps) {
  const [mode, setMode] = useState<"auto" | "custom">(compareMode);
  const [compareDates, setCompareDates] = useState({ compareStart, compareEnd });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname() || "/admin/financeiro";
  const searchParams = useSearchParams();

  useEffect(() => {
    setMode(compareMode);
    setCompareDates({ compareStart, compareEnd });
  }, [compareEnd, compareMode, compareStart]);

  function submitCustomComparison(
    nextCompareMode: string,
    nextCompareStart: string,
    nextCompareEnd: string
  ) {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");

    nextParams.set("compareMode", nextCompareMode);
    if (nextCompareStart) {
      nextParams.set("compareStart", nextCompareStart);
    } else {
      nextParams.delete("compareStart");
    }

    if (nextCompareEnd) {
      nextParams.set("compareEnd", nextCompareEnd);
    } else {
      nextParams.delete("compareEnd");
    }

    startTransition(() => {
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    });
  }

  return (
    <form className="dashboard-subpanel mb-4 p-4">
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="end" value={end} />
      <input type="hidden" name="historyStart" value={historyStart} />
      <input type="hidden" name="historyEnd" value={historyEnd} />

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <PremiumSelect
            name="compareMode"
            label="Comparar com"
            value={mode}
            options={[
              { value: "auto", label: "Período anterior automático" },
              { value: "custom", label: "Datas escolhidas por mim" },
            ]}
            onChange={(value) => setMode(value as "auto" | "custom")}
          />
        </div>

        <div>
          <PremiumDatePicker
            name="compareStart"
            label="Data inicial da comparacao"
            value={compareDates.compareStart}
            disabled={mode !== "custom"}
            onChange={(value) => {
              if (mode !== "custom") return;
              const next = { ...compareDates, compareStart: value };
              setCompareDates(next);
              submitCustomComparison(mode, next.compareStart, next.compareEnd);
            }}
          />
        </div>

        <div>
          <PremiumDatePicker
            name="compareEnd"
            label="Data final da comparacao"
            value={compareDates.compareEnd}
            disabled={mode !== "custom"}
            onChange={(value) => {
              if (mode !== "custom") return;
              const next = { ...compareDates, compareEnd: value };
              setCompareDates(next);
              submitCustomComparison(mode, next.compareStart, next.compareEnd);
            }}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {mode === "custom"
          ? isPending
            ? "Atualizando comparacao..."
            : "A comparacao atualiza automaticamente ao trocar as datas."
          : "Para escolher as datas, mude para datas escolhidas por mim."}
      </p>
    </form>
  );
}
