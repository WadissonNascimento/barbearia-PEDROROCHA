"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PremiumDatePicker } from "@/components/ui/PremiumFilters";

export default function BarberFinanceFilters({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStart, setSelectedStart] = useState(start);
  const [selectedEnd, setSelectedEnd] = useState(end);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedStart(start);
    setSelectedEnd(end);
  }, [start, end]);

  function applyManualRange() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", selectedStart);
    params.set("end", selectedEnd);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  }

  const canApply = Boolean(selectedStart && selectedEnd);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (canApply) {
          applyManualRange();
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <PremiumDatePicker
          label="Inicio"
          value={selectedStart}
          onChange={setSelectedStart}
          required
        />
        <PremiumDatePicker
          label="Fim"
          value={selectedEnd}
          onChange={setSelectedEnd}
          required
        />
      </div>

      <button
        type="submit"
        disabled={!canApply || isPending}
        className="min-h-11 w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Filtrando..." : "Aplicar filtro"}
      </button>
    </form>
  );
}
