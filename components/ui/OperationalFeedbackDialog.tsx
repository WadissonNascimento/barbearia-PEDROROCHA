"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type OperationalFeedbackTone = "error" | "success" | "info";

export type OperationalFeedbackState = {
  title: string;
  message: string;
  tone?: OperationalFeedbackTone;
} | null;

export default function OperationalFeedbackDialog({
  feedback,
  onClose,
  closeLabel = "Entendi",
}: {
  feedback: OperationalFeedbackState;
  onClose: () => void;
  closeLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !feedback) {
    return null;
  }

  const tone = feedback.tone || "error";
  const toneStyles = {
    error: {
      eyebrow: "Atencao",
      ring: "border-rose-300/25 bg-rose-500/10 text-rose-100",
      icon: <AlertTriangle className="h-6 w-6" />,
      button:
        "bg-rose-500 text-white shadow-[0_18px_40px_rgba(244,63,94,0.22)] hover:bg-rose-400",
    },
    success: {
      eyebrow: "Tudo certo",
      ring: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
      icon: <CheckCircle2 className="h-6 w-6" />,
      button:
        "bg-emerald-500 text-white shadow-[0_18px_40px_rgba(16,185,129,0.22)] hover:bg-emerald-400",
    },
    info: {
      eyebrow: "Aviso",
      ring: "border-[var(--brand)]/35 bg-[var(--brand-muted)] text-[var(--brand-strong)]",
      icon: <Info className="h-6 w-6" />,
      button:
        "bg-[var(--brand)] text-white shadow-[0_18px_40px_rgba(14,165,233,0.22)] hover:brightness-110",
    },
  }[tone];

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 py-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-md"
      role="presentation"
      onClick={onClose}
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-sm overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,24,36,0.98),rgba(5,11,22,0.98))] p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-80" />
        <div className="flex items-start gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${toneStyles.ring}`}
          >
            {toneStyles.icon}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              {toneStyles.eyebrow}
            </p>
            <h2 id={titleId} className="mt-2 text-xl font-black leading-tight text-white">
              {feedback.title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-zinc-300">
              {feedback.message}
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`mt-5 min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-black transition disabled:opacity-70 ${toneStyles.button}`}
        >
          {closeLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}
