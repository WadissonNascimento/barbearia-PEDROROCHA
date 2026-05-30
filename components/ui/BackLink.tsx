"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackLink({
  href,
  area,
  className = "",
}: {
  href: string;
  area: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] outline-none transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)] focus-visible:border-[var(--brand)]/70 focus-visible:ring-2 focus-visible:ring-sky-400/30 ${className}`.trim()}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--brand)]/30 bg-[var(--brand-muted)] text-[var(--brand-strong)] transition group-hover:-translate-x-0.5">
        <ArrowLeft className="h-4 w-4" />
      </span>
      <span className="truncate">Voltar {area}</span>
    </Link>
  );
}
