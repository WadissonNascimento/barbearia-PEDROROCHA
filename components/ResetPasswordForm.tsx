"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import {
  resendPasswordResetCodeAction,
  resetPasswordWithCodeAction,
} from "@/app/forgot-password/actions";
import FormFeedback from "@/components/FormFeedback";
import SubmitButton from "@/components/SubmitButton";
import { initialFormFeedbackState } from "@/lib/formFeedbackState";
import { NEW_PASSWORD_REQUIREMENT_MESSAGE } from "@/lib/passwordPolicy";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#243754] px-4 py-4 text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 placeholder:text-zinc-400";

const passwordInputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#020817] px-4 py-4 text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 placeholder:text-zinc-400";

export default function ResetPasswordForm({
  email,
  sent,
  devCode,
}: {
  email: string;
  sent: boolean;
  devCode?: string;
}) {
  const [resetState, resetAction] = useFormState(
    resetPasswordWithCodeAction,
    initialFormFeedbackState
  );
  const [resendState, resendAction] = useFormState(
    resendPasswordResetCodeAction,
    initialFormFeedbackState
  );
  const safeResetState = resetState ?? initialFormFeedbackState;
  const safeResendState = resendState ?? initialFormFeedbackState;

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.35em] text-sky-300">
          Nova senha
        </p>
        <h1 className="text-4xl font-bold">Redefinir senha</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Digite o código enviado para <span className="font-semibold text-white">{email}</span> e escolha sua nova senha.
        </p>
      </div>

      <FormFeedback
        success={
          devCode
            ? `Código de recuperação local: ${devCode}`
            : sent
            ? "Enviamos um código de recuperação para o seu e-mail."
            : safeResetState.success
        }
        error={safeResetState.error}
      />

      <form action={resetAction} className="mt-5 space-y-5">
        <input type="hidden" name="email" value={email} />

        <div>
          <label
            htmlFor="code"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Código de recuperação
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

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Nova senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            pattern="(?=.*[A-Za-zÀ-ÿ])(?=.*\d).{8,}"
            title={NEW_PASSWORD_REQUIREMENT_MESSAGE}
            aria-describedby="password-requirement"
            className={passwordInputClassName}
            placeholder="Minimo 8 caracteres"
          />
          <p id="password-requirement" className="mt-2 text-xs text-zinc-400">
            {NEW_PASSWORD_REQUIREMENT_MESSAGE}
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            className={passwordInputClassName}
            placeholder="Repita a nova senha"
          />
        </div>

        <SubmitButton idleText="Salvar nova senha" loadingText="Salvando..." />
      </form>

      <div className="mt-6 border-t border-white/10 pt-6">
        <FormFeedback success={safeResendState.success} error={safeResendState.error} />

        <form action={resendAction} className="mt-4">
          <input type="hidden" name="email" value={email} />
          <SubmitButton
            idleText="Reenviar código"
            loadingText="Reenviando..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 font-semibold text-white transition hover:border-sky-400/40 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-300">
        Voltar para{" "}
        <Link href="/login" className="font-semibold text-sky-300 hover:underline">
          o login
        </Link>
      </p>
    </div>
  );
}
