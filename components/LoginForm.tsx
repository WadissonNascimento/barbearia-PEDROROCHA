"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import AuthFormMessage from "@/components/AuthFormMessage";
import FeedbackMessage from "@/components/FeedbackMessage";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import ReliableSubmitButton from "@/components/ReliableSubmitButton";

export default function LoginForm({
  errorMessage = null,
  successMessage = null,
  googleSignInEnabled = false,
  redirectTo = "",
}: {
  errorMessage?: string | null;
  successMessage?: string | null;
  googleSignInEnabled?: boolean;
  redirectTo?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <div className="surface-card-strong w-full max-w-md rounded-[32px] p-6 shadow-2xl sm:p-8">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.35em] text-[var(--brand-strong)]">
          Login
        </p>
        <h1 className="text-4xl font-bold">Entrar</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Entre para acessar sua conta e acompanhar seus horarios.
        </p>
      </div>

      <div className="space-y-3">
        <FeedbackMessage message={successMessage} tone="success" />
        <AuthFormMessage message={errorMessage} />
      </div>

      <form action="/login/submit" method="post" className="space-y-5">
        <input type="hidden" name="redirectTo" value={redirectTo} />

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
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white outline-none placeholder:text-zinc-400"
            placeholder="seuemail@exemplo.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-zinc-200"
          >
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 pr-14 text-white outline-none placeholder:text-zinc-400"
              placeholder="Digite sua senha"
            />
            {password ? (
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
          <div className="mt-3 text-right text-sm">
            <Link
              href="/forgot-password"
              className="font-semibold text-[var(--brand-strong)] hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
        </div>

        <ReliableSubmitButton idleText="Entrar" loadingText="Entrando..." />
      </form>

      {googleSignInEnabled ? (
        <div className="mt-4">
          <GoogleSignInButton redirectTo={redirectTo || "/redirecionar"} />
        </div>
      ) : null}

      <p className="mt-6 text-center text-sm text-zinc-300">
        Ainda nao tem conta?{" "}
        <Link
          href={
            redirectTo
              ? `/register?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/register"
          }
          className="font-semibold text-[var(--brand-strong)] hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}
