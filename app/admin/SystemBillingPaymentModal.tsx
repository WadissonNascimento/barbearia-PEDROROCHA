"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, Clipboard, ShieldCheck } from "lucide-react";
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
  const [isVisible, setIsVisible] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copiar chave Pix");

  useEffect(() => {
    if (state.ok) {
      setIsVisible(false);
    }
  }, [state.ok]);

  if (!isVisible) {
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
    <div
      className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="system-billing-title"
        aria-describedby="system-billing-description"
        className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-amber-300/35 bg-[linear-gradient(145deg,rgba(28,20,12,0.98),rgba(5,5,5,0.98))] p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,0.72)]"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />

        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/12 text-amber-200">
            <AlertTriangle className="h-7 w-7" />
          </span>

          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-200">
              Pagamento da plataforma
            </p>
            <h2
              id="system-billing-title"
              className="mt-2 text-2xl font-black leading-tight text-white"
            >
              Hoje é dia de pagar o plano do sistema
            </h2>
            <p
              id="system-billing-description"
              className="mt-3 text-sm leading-6 text-zinc-300"
            >
              A mensalidade da barbearia venceu em {alert.dueDateLabel}. Para
              manter o site, os agendamentos, o painel administrativo e as
              notificações funcionando normalmente, confirme o Pix de{" "}
              <strong className="text-white">{alert.amountLabel}</strong>.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 p-4">
          <p className="text-sm font-black text-red-100">
            Se o pagamento não for confirmado até {alert.graceDateLabel}, o site
            poderá ser suspenso automaticamente.
          </p>
          <p className="mt-2 text-xs leading-5 text-red-100/80">
            Este aviso só sai do painel quando a conta responsável pela
            plataforma confirmar o pagamento.
          </p>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Chave Pix
            </span>
            <strong className="text-right text-lg text-white tabular-nums">
              {alert.pixKey}
            </strong>
          </div>
          <button
            type="button"
            onClick={copyPixKey}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
          >
            <Clipboard className="h-4 w-4" />
            {copyLabel}
          </button>
        </div>

        {state.message ? (
          <p
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
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
          <form action={action} className="mt-5">
            <input type="hidden" name="paymentId" value={alert.paymentId} />
            <ConfirmPaymentButton />
          </form>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
              <p className="text-sm leading-6 text-zinc-300">
                Seu usuário pode ver o aviso, mas não pode dar baixa. A baixa
                só é liberada para a conta responsável pela plataforma.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmPaymentButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <CheckCircle2 className="h-5 w-5" />
      {pending ? "Confirmando..." : "Marcar mensalidade como paga"}
    </button>
  );
}
