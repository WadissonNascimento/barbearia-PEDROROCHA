import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export default function DashboardEntryCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[74px] items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 transition duration-200 hover:border-[var(--brand)]/35 hover:bg-[var(--brand-muted)] focus-visible:border-[var(--brand)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20"
    >
      <div
        data-dashboard-entry-icon
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--brand)]"
      >
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-white sm:text-base">{title}</h2>
        <p className="mt-1 truncate text-xs text-zinc-400 sm:text-sm">{description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {badge ? (
          <span className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand-muted)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-strong)]">
            {badge}
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
      </div>
    </Link>
  );
}
