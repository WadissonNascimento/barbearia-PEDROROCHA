"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerCustomerAction } from "@/app/register/actions";
import FeedbackMessage from "@/components/FeedbackMessage";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PhoneInput from "@/components/ui/PhoneInput";
import SubmitButton from "@/components/SubmitButton";
import {
  CUSTOMER_PASSWORD_REQUIREMENT_MESSAGE,
  FULL_NAME_REQUIREMENT_MESSAGE,
  isValidCustomerFullName,
  isValidCustomerPassword,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";
import { initialFormFeedbackState } from "@/lib/formFeedbackState";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white outline-none transition focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-zinc-400";

const passwordInputClassName =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white outline-none transition focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-zinc-400";

export default function RegisterForm({
  googleSignInEnabled = false,
  redirectTo = "",
}: {
  googleSignInEnabled?: boolean;
  redirectTo?: string;
}) {
  const [state, formAction] = useActionState(
    registerCustomerAction,
    initialFormFeedbackState
  );
  const formState = state ?? initialFormFeedbackState;
  const [name, setName] = useState("");
  const [showNameError, setShowNameError] = useState(false);
  const [password, setPassword] = useState("");
  const [showPasswordError, setShowPasswordError] = useState(false);
  const hasNameError = showNameError && !isValidCustomerFullName(name);
  const hasPasswordError =
    showPasswordError && !isValidCustomerPassword(password);

  return (
    <div className="surface-card-strong w-full max-w-md rounded-[32px] p-6 shadow-2xl sm:p-8">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.35em] text-[var(--brand-strong)]">
          Cadastro
        </p>
        <h1 className="text-4xl font-bold">Criar conta</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Crie sua conta de cliente para agendar. Antes de finalizar, você confirma um código enviado por e-mail.
        </p>
      </div>

      <form
        action={formAction}
        className="space-y-5"
        onSubmit={(event) => {
          const normalizedName = normalizeCustomerName(name);
          const validName = isValidCustomerFullName(normalizedName);
          const validPassword = isValidCustomerPassword(password);

          setName(normalizedName);
          setShowNameError(!validName);
          setShowPasswordError(!validPassword);

          if (!validName || !validPassword) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <FeedbackMessage message={formState.error} tone="error" />

        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onBlur={() => {
              setName((currentName) => normalizeCustomerName(currentName));
              setShowNameError(true);
            }}
            onChange={(event) => {
              setName(event.target.value);
              if (showNameError || event.target.value.length > 0) {
                setShowNameError(true);
              }
            }}
            onInvalid={() => setShowNameError(true)}
            aria-invalid={hasNameError}
            aria-describedby="name-error"
            className={`${inputClassName} ${
              hasNameError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                : ""
            }`}
            placeholder="Nome e sobrenome"
            title={FULL_NAME_REQUIREMENT_MESSAGE}
          />
          {hasNameError && (
            <p
              id="name-error"
              className="mt-2 flex items-start gap-2 text-sm text-red-400"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 text-[10px] font-semibold"
              >
                !
              </span>
              <span>{FULL_NAME_REQUIREMENT_MESSAGE}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Email
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

        <div>
          <label
            htmlFor="phone"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Telefone
          </label>
          <PhoneInput
            id="phone"
            name="phone"
            required
            className={inputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            pattern="^(?=.*[A-Za-zÀ-ÿ])(?=.*[0-9]).{8,}$"
            value={password}
            onBlur={() => setShowPasswordError(true)}
            onChange={(event) => {
              setPassword(event.target.value);
              if (showPasswordError || event.target.value.length > 0) {
                setShowPasswordError(true);
              }
            }}
            onInvalid={() => setShowPasswordError(true)}
            aria-invalid={hasPasswordError}
            aria-describedby="password-error"
            className={`${passwordInputClassName} ${
              hasPasswordError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                : ""
            }`}
            placeholder="Senha"
            title={CUSTOMER_PASSWORD_REQUIREMENT_MESSAGE}
          />
          {hasPasswordError && (
            <p
              id="password-error"
              className="mt-2 flex items-start gap-2 text-sm text-red-400"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 text-[10px] font-semibold"
              >
                !
              </span>
              <span>{CUSTOMER_PASSWORD_REQUIREMENT_MESSAGE}</span>
            </p>
          )}
        </div>

        <SubmitButton idleText="Criar conta" loadingText="Criando conta..." />
      </form>

      {googleSignInEnabled && (
        <div className="mt-4">
          <GoogleSignInButton redirectTo={redirectTo || "/redirecionar"} />
        </div>
      )}

      <p className="mt-6 text-center text-sm text-zinc-300">
        Já tem conta?{" "}
        <Link
          href={
            redirectTo
              ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/login"
          }
          className="font-semibold text-[var(--brand-strong)] hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
