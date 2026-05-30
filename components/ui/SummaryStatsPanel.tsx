import type { ReactNode } from "react";

type StatTone = "neutral" | "info" | "success" | "warning" | "danger";

type SummaryStat = {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: StatTone;
};

const toneClasses: Record<StatTone, string> = {
  neutral: "text-white",
  info: "text-[var(--brand-strong)]",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-rose-300",
};

export default function SummaryStatsPanel({
  eyebrow = "Resumo",
  title,
  description,
  stats,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  stats: SummaryStat[];
  className?: string;
}) {
  return (
    <section className={`dashboard-panel p-4 sm:p-5 ${className}`.trim()}>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
          {eyebrow}
        </p>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-zinc-400">{description}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="dashboard-subpanel px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              {stat.label}
            </p>
            <p
              className={`mt-2 break-words text-2xl font-black ${
                toneClasses[stat.tone || "neutral"]
              }`}
            >
              {stat.value}
            </p>
            {stat.helper ? (
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {stat.helper}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
