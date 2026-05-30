"use client";

import Link from "next/link";
import { useActionState } from "react";
import { initialFormFeedbackState } from "@/lib/formFeedbackState";
import {
  resendRegistrationCodeAction,
  verifyRegistrationCodeAction,
} from "@/app/register/actions";
import FormFeedback from "@/components/FormFeedback";
import SubmitButton from "@/components/SubmitButton";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#243754] px-4 py-4 text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 placeholder:text-zinc-400";

export default function RegisterVerifyForm({
  email,
  sent,
  devCode,
  redirectTo,
}: {
  email: string;
  sent: boolean;
  devCode?: string;
  redirectTo?: string;
}) {
  const [verifyState, verifyAction] = useActionState(
    verifyRegistrationCodeAction,
    initialFormFeedbackState
  );
  const [resendState, resendAction] = useActionState(
    resendRegistrationCodeAction,
    initialFormFeedbackState
  );
  const safeVerifyState = verifyState ?? initialFormFeedbackState;
  const safeResendState = resendState ?? initialFormFeedbackState;

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.35em] text-sky-300">
          Confirmação
        </p>
        <h1 className="text-4xl font-bold">Validar e-mail</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Digite o código enviado para <span className="font-semibold text-white">{email}</span>.
        </p>
      </div>

      <FormFeedback
        success={
          devCode
            ? `Código de verificação local: ${devCode}`
            : sent
            ? "Enviamos um código de verificação para o seu e-mail."
            : safeVerifyState.success
        }
        error={safeVerifyState.error}
      />

      <form action={verifyAction} className="mt-5 space-y-5">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="redirectTo" value={redirectTo || ""} />

        <div>
          <label
            htmlFor="code"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Código de verificação
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            className={inputClassName}
            placeholder="Digite os 6 digitos"
          />
        </div>

        <SubmitButton idleText="Finalizar cadastro" loadingText="Validando..." />
      </form>

      <div className="mt-6 border-t border-white/10 pt-6">
        <FormFeedback success={safeResendState.success} error={safeResendState.error} />

        <form action={resendAction} className="mt-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="redirectTo" value={redirectTo || ""} />
          <SubmitButton
            idleText="Reenviar código"
            loadingText="Reenviando..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 font-semibold text-white transition hover:border-sky-400/40 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-300">
        Digitou o e-mail errado?{" "}
        <Link
          href={
            redirectTo
              ? `/register?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/register"
          }
          className="font-semibold text-sky-300 hover:underline"
        >
          Voltar ao cadastro
        </Link>
      </p>
    </div>
  );
}
