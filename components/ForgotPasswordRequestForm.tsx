"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { requestPasswordResetAction } from "@/app/forgot-password/actions";
import FormFeedback from "@/components/FormFeedback";
import SubmitButton from "@/components/SubmitButton";
import { initialFormFeedbackState } from "@/lib/formFeedbackState";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#243754] px-4 py-4 text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 placeholder:text-zinc-400";

export default function ForgotPasswordRequestForm() {
  const [state, formAction] = useFormState(
    requestPasswordResetAction,
    initialFormFeedbackState
  );
  const formState = state ?? initialFormFeedbackState;

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.35em] text-sky-300">
          Recuperação
        </p>
        <h1 className="text-4xl font-bold">Esqueceu a senha?</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Informe seu e-mail para receber um código de recuperação.
        </p>
      </div>

      <FormFeedback error={formState.error} success={formState.success} />

      <form action={formAction} className="mt-5 space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={inputClassName}
            placeholder="seuemail@exemplo.com"
          />
        </div>

        <SubmitButton idleText="Enviar código" loadingText="Enviando..." />
      </form>

      <p className="mt-6 text-center text-sm text-zinc-300">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-semibold text-sky-300 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
