import Link from "next/link";

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-5 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 leading-6 text-zinc-400">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-sky-400/40 hover:bg-sky-500/10"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
