"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  markSystemBillingPaymentPaidAction,
  type SystemBillingActionState,
} from "./systemBillingActions";
import type { SystemBillingAlert } from "@/lib/systemBilling";

const initialState: SystemBillingActionState = {
  ok: false,
  message: null,
};

export default function SystemBillingPaymentModal({
  alert,
}: {
  alert: NonNullable<SystemBillingAlert>;
}) {
  const [state, action] = useActionState(
    markSystemBillingPaymentPaidAction,
    initialState
  );
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaidConfirmed, setIsPaidConfirmed] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copiar chave Pix");

  useEffect(() => {
    if (state.ok) {
      setIsPaidConfirmed(true);
    }
  }, [state.ok]);

  if (isPaidConfirmed) {
    return null;
  }

  async function copyPixKey() {
    try {
      await navigator.clipboard.writeText(alert.pixKey);
      setCopyLabel("Pix copiado");
      window.setTimeout(() => setCopyLabel("Copiar chave Pix"), 1800);
    } catch {
      setCopyLabel("Copie manualmente");
    }
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4 text-white sm:px-6 sm:pt-6">
        <div className="overflow-hidden rounded-[26px] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(120,68,20,0.28),rgba(8,8,8,0.92))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
                Mensalidade pendente
              </p>
              <h2 className="mt-1 text-xl font-black leading-tight text-white">
                Plano do sistema aguardando pagamento
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Venceu em {alert.dueDateLabel}. Pix {alert.pixKey}. Se não for
                confirmado até {alert.graceDateLabel}, o site poderá ser
                suspenso automaticamente.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:min-w-56">
              <strong className="text-left text-2xl font-black text-white sm:text-right">
                {alert.amountLabel}
              </strong>
              {alert.canMarkPaid ? (
                <form action={action}>
                  <input type="hidden" name="paymentId" value={alert.paymentId} />
                  <ConfirmPaymentButton compact />
                </form>
              ) : (
                <span className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-amber-100">
                  Baixa restrita
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isDismissed ? (
        <div
          className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/80 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="system-billing-title"
            aria-describedby="system-billing-description"
            className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[24px] border border-amber-300/35 bg-[linear-gradient(145deg,rgba(28,20,12,0.98),rgba(5,5,5,0.98))] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.72)] sm:rounded-[30px] sm:p-5"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />

            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setIsDismissed(true)}
              className="sticky left-full top-0 z-10 -mb-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-zinc-200 backdrop-blur transition hover:bg-white/[0.12]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-11 sm:gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/12 text-amber-200 sm:h-14 sm:w-14">
                <AlertTriangle className="h-5 w-5 sm:h-7 sm:w-7" />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200 sm:text-[11px] sm:tracking-[0.26em]">
                  Pagamento da plataforma
                </p>
                <h2
                  id="system-billing-title"
                  className="mt-1 text-xl font-black leading-tight text-white sm:mt-2 sm:text-2xl"
                >
                  Hoje é dia de pagar o plano do sistema
                </h2>
                <p
                  id="system-billing-description"
                  className="mt-2 text-sm leading-5 text-zinc-300 sm:mt-3 sm:leading-6"
                >
                  Mensalidade vencida em {alert.dueDateLabel}. Confirme o Pix de{" "}
                  <strong className="text-white">{alert.amountLabel}</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 p-3 sm:mt-5 sm:p-4">
              <p className="text-sm font-black leading-5 text-red-100">
                Sem confirmação até {alert.graceDateLabel}, o site poderá ser
                suspenso automaticamente.
              </p>
              <p className="mt-1 text-xs leading-4 text-red-100/80 sm:mt-2 sm:leading-5">
                O popup volta ao abrir o painel. O aviso só sai definitivamente
                após a baixa da conta responsável.
              </p>
            </div>

            <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 sm:mt-4 sm:gap-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 sm:text-xs">
                  Chave Pix
                </span>
                <strong className="text-right text-base font-black text-white tabular-nums sm:text-lg">
                  {alert.pixKey}
                </strong>
              </div>
              <button
                type="button"
                onClick={copyPixKey}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.1] sm:min-h-11 sm:py-3"
              >
                <Clipboard className="h-4 w-4" />
                {copyLabel}
              </button>
            </div>

            {state.message ? (
              <p
                className={`mt-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold sm:mt-4 sm:px-4 sm:py-3 ${
                  state.ok
                    ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                    : "border-red-300/30 bg-red-500/10 text-red-100"
                }`}
                role={state.ok ? "status" : "alert"}
              >
                {state.message}
              </p>
            ) : null}

            {alert.canMarkPaid ? (
              <form action={action} className="mt-3 sm:mt-5">
                <input type="hidden" name="paymentId" value={alert.paymentId} />
                <ConfirmPaymentButton />
              </form>
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:mt-5 sm:p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200 sm:h-5 sm:w-5" />
                  <p className="text-xs leading-5 text-zinc-300 sm:text-sm sm:leading-6">
                    Você pode fechar este popup, mas a baixa só é liberada para
                    a conta responsável pela plataforma.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConfirmPaymentButton({ compact = false }: { compact?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70 ${
        compact ? "min-h-10 py-2.5" : "min-h-12 py-3"
      }`}
    >
      <CheckCircle2 className="h-5 w-5" />
      {pending
        ? "Confirmando..."
        : compact
          ? "Marcar como pago"
          : "Marcar mensalidade como paga"}
    </button>
  );
}
