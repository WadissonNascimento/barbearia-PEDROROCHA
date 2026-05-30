"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PremiumDatePicker } from "@/components/ui/PremiumFilters";

export default function FinanceHistoryFilters({
  historyStart,
  historyEnd,
}: {
  historyStart: string;
  historyEnd: string;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/admin/financeiro";
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({ historyStart, historyEnd });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFilters({ historyStart, historyEnd });
  }, [historyEnd, historyStart]);

  function applyFilters(next: typeof filters) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (next.historyStart) params.set("historyStart", next.historyStart);
    else params.delete("historyStart");

    if (next.historyEnd) params.set("historyEnd", next.historyEnd);
    else params.delete("historyEnd");

    startTransition(() => {
      router.replace(
        params.toString() ? `${pathname}?${params.toString()}` : pathname,
        { scroll: false }
      );
    });
  }

  return (
    <form className="grid min-w-0 gap-2 sm:min-w-[21rem]">
      <div className="grid min-w-0 gap-2 min-[460px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[460px]:items-center">
        <PremiumDatePicker
          name="historyStart"
          value={filters.historyStart}
          onChange={(value) => {
            const next = {
              ...filters,
              historyStart: value,
            };

            setFilters(next);
            applyFilters(next);
          }}
        />
        <span className="text-xs text-zinc-500">até</span>
        <PremiumDatePicker
          name="historyEnd"
          value={filters.historyEnd}
          onChange={(value) => {
            const next = {
              ...filters,
              historyEnd: value,
            };

            setFilters(next);
            applyFilters(next);
          }}
        />
      </div>

      <p className="text-xs text-zinc-500">
        {isPending ? "Atualizando lista..." : "A lista muda ao trocar as datas."}
      </p>
    </form>
  );
}
