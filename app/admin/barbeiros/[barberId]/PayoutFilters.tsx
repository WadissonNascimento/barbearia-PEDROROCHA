"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function PayoutFilters({
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

  const canApply = Boolean(selectedStart && selectedEnd);

  function applyRange() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", selectedStart);
    params.set("end", selectedEnd);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  }

  return (
    <form
      className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (canApply) {
          applyRange();
        }
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
        Filtrar periodo
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-zinc-400">
            Inicio
          </span>
          <input
            type="date"
            name="start"
            value={selectedStart}
            onChange={(event) => setSelectedStart(event.target.value)}
            className="form-control"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-zinc-400">
            Fim
          </span>
          <input
            type="date"
            name="end"
            value={selectedEnd}
            onChange={(event) => setSelectedEnd(event.target.value)}
            className="form-control"
            required
          />
        </label>
        <button
          type="submit"
          disabled={!canApply || isPending}
          className="btn-primary self-end disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Aplicando..." : "Aplicar"}
        </button>
      </div>
    </form>
  );
}
