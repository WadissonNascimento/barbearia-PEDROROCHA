"use client";

import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import type { MutationResult } from "@/lib/mutationResult";

type AccountPasswordFormProps = {
  action: (formData: FormData) => Promise<MutationResult>;
  title?: string;
  description?: string;
};

export default function AccountPasswordForm({
  action,
  title = "Seguranca da conta",
  description = "Troque sua senha de acesso quando precisar.",
}: AccountPasswordFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs text-zinc-400">{description}</p>
      </div>

      {isOpen ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);

            startTransition(async () => {
              const result = await action(formData);
              setFeedback({ message: result.message, tone: result.tone });

              if (result.ok) {
                form.reset();
                setIsOpen(false);
              }
            });
          }}
        >
          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          <PasswordField
            name="currentPassword"
            label="Senha atual"
            autoComplete="current-password"
          />
          <PasswordField
            name="newPassword"
            label="Nova senha"
            autoComplete="new-password"
          />
          <PasswordField
            name="confirmPassword"
            label="Confirmar nova senha"
            autoComplete="new-password"
          />

          <button type="submit" disabled={isPending} className="btn-primary w-full">
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setFeedback({ message: null, tone: "success" });
              setIsOpen(false);
            }}
            className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-60"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <>
          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          <button
            type="button"
            onClick={() => {
              setFeedback({ message: null, tone: "success" });
              setIsOpen(true);
            }}
            className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Trocar senha
          </button>
        </>
      )}
    </section>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <input
        name={name}
        type="password"
        required
        minLength={8}
        autoComplete={autoComplete}
        className="form-control text-sm"
      />
    </label>
  );
}
