type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-zinc-400">{helper}</p>
    </div>
  );
}
