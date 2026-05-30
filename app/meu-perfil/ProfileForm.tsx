"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import PhoneInput from "@/components/ui/PhoneInput";
import {
  FULL_NAME_REQUIREMENT_MESSAGE,
  isValidCustomerFullName,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";
import { formatBrazilianPhone } from "@/lib/phone";
import {
  updateCustomerPasswordAction,
  updateCustomerProfileAction,
  verifyCustomerEmailChangeAction,
} from "./actions";

type ProfileMode = "view" | "contact" | "password";

export default function ProfileForm({
  customer,
  pendingEmailChange,
}: {
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  pendingEmailChange: {
    email: string;
    expiresAt: string;
  } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ProfileMode>("view");
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();

  return (
    <section className="mt-5 max-w-xl rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">Contato do cliente</p>
        <p className="mt-1 text-xs text-zinc-400">
          Nome, e-mail e telefone do seu perfil.
        </p>
      </div>

      {mode === "contact" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const normalizedName = normalizeCustomerName(
              String(formData.get("name") || "")
            );

            if (!isValidCustomerFullName(normalizedName)) {
              setFeedback({
                message: FULL_NAME_REQUIREMENT_MESSAGE,
                tone: "error",
              });
              return;
            }

            formData.set("name", normalizedName);

            startTransition(async () => {
              const result = await updateCustomerProfileAction(formData);
              setFeedback({ message: result.message, tone: result.tone });

              if (result.ok) {
                setMode("view");
                router.refresh();
              }
            });
          }}
        >
          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Nome
            </span>
            <input
              name="name"
              defaultValue={customer.name || ""}
              required
              maxLength={120}
              title={FULL_NAME_REQUIREMENT_MESSAGE}
              onBlur={(event) => {
                event.currentTarget.value = normalizeCustomerName(
                  event.currentTarget.value
                );
              }}
              className="form-control text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              E-mail
            </span>
            <input
              name="email"
              type="email"
              defaultValue={customer.email || ""}
              required
              maxLength={254}
              className="form-control text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Telefone
            </span>
            <PhoneInput
              name="phone"
              defaultValue={formatBrazilianPhone(customer.phone)}
              className="form-control text-sm"
            />
          </label>

          <button type="submit" disabled={isPending} className="btn-primary w-full">
            {isPending ? "Salvando..." : "Salvar contato"}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setFeedback({ message: null, tone: "success" });
              setMode("view");
            }}
            className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-60"
          >
            Cancelar
          </button>
        </form>
      ) : mode === "password" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);

            startTransition(async () => {
              const result = await updateCustomerPasswordAction(formData);
              setFeedback({ message: result.message, tone: result.tone });

              if (result.ok) {
                form.reset();
                setMode("view");
              }
            });
          }}
        >
          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Senha atual
            </span>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="form-control text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Nova senha
            </span>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="form-control text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Confirmar nova senha
            </span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="form-control text-sm"
            />
          </label>

          <button type="submit" disabled={isPending} className="btn-primary w-full">
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setFeedback({ message: null, tone: "success" });
              setMode("view");
            }}
            className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-60"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <>
          <div className="mt-4 grid gap-2 text-sm">
            <ProfileValue label="Nome" value={customer.name || "Não informado"} />
            <ProfileValue label="E-mail" value={customer.email || "Não informado"} />
            <ProfileValue
              label="Telefone"
              value={formatBrazilianPhone(customer.phone) || "Não informado"}
            />
          </div>

          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          {pendingEmailChange ? (
            <form
              className="mt-4 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);

                startTransition(async () => {
                  const result = await verifyCustomerEmailChangeAction(formData);
                  setFeedback({ message: result.message, tone: result.tone });

                  if (result.ok) {
                    form.reset();
                    router.refresh();
                  }
                });
              }}
            >
              <p className="text-xs font-semibold text-white">
                Confirme seu novo e-mail
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">
                Enviamos um codigo para {pendingEmailChange.email}. O telefone
                nao precisa de verificacao por SMS.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="Codigo"
                  className="form-control text-sm sm:flex-1"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary px-4 py-3 text-sm sm:w-auto"
                >
                  {isPending ? "Verificando..." : "Verificar e-mail"}
                </button>
              </div>
            </form>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setFeedback({ message: null, tone: "success" });
              setMode("contact");
            }}
            className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Editar contato
          </button>

          <button
            type="button"
            onClick={() => {
              setFeedback({ message: null, tone: "success" });
              setMode("password");
            }}
            className="mt-2 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Trocar senha
          </button>
        </>
      )}
    </section>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
