"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import EmptyState from "@/components/ui/EmptyState";
import PhoneInput from "@/components/ui/PhoneInput";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatBrazilianPhone } from "@/lib/phone";
import { createBarberAction } from "./actions";

type BarberItem = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  isActive: boolean;
  barberAppointments: Array<{ id: string }>;
};

type PendingBarberItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  expiresAt: Date;
};

export default function AdminBarbersClient({
  barbers,
  pendingBarbers,
  barberLimit,
  usedBarberSlots,
  initialFeedback,
}: {
  barbers: BarberItem[];
  pendingBarbers: PendingBarberItem[];
  barberLimit: number | null;
  usedBarberSlots: number;
  initialFeedback?: {
    message: string;
    tone: "success" | "error" | "info";
  } | null;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>(
    initialFeedback
      ? { message: initialFeedback.message, tone: initialFeedback.tone }
      : { message: null, tone: "success" },
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const barberLimitReached = barberLimit !== null && usedBarberSlots >= barberLimit;

  function runAction(
    key: string,
    action: (formData: FormData) => Promise<{
      ok: boolean;
      message: string;
      tone: "success" | "error" | "info";
    }>,
    formData: FormData,
    onSuccess?: () => void,
  ) {
    setPendingKey(key);

    startTransition(async () => {
      const result = await action(formData);
      setFeedback({ message: result.message, tone: result.tone });

      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }

      setPendingKey(null);
    });
  }

  return (
    <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      <section className="dashboard-subpanel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Uso do plano</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Barbeiros ativos e convites pendentes contam no limite da barbearia.
            </p>
          </div>
          <StatusBadge variant={barberLimitReached ? "warning" : "success"}>
            {barberLimit === null
              ? `${usedBarberSlots} / ilimitado`
              : `${usedBarberSlots} / ${barberLimit} barbeiros`}
          </StatusBadge>
        </div>
      </section>

      <section className="dashboard-subpanel p-4">
        <h2 className="text-xl font-bold text-white">
          Equipe atual de Barbeiros
        </h2>
        <div className="mt-4">
          {barbers.length === 0 ? (
            <EmptyState
              title="Nenhum barbeiro cadastrado"
              description="Depois que um convite for confirmado, o barbeiro aparecerá aqui."
            />
          ) : (
            <div className="space-y-3">
              {barbers.map((barber) => (
                <Link
                  key={barber.id}
                  href={`/admin/barbeiros/${barber.id}`}
                  className="flex items-center gap-3 rounded-[24px] border border-[var(--brand)]/25 bg-[linear-gradient(180deg,var(--panel-bg-strong),rgba(13,18,30,0.94))] px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.22)] transition hover:border-[var(--brand)]/45 hover:bg-[var(--brand-muted)]"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[var(--brand)]/30 bg-[var(--brand-muted)] text-xl font-semibold text-[var(--brand-strong)]">
                    {barber.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={barber.image}
                        alt={barber.name || "Barbeiro"}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (barber.name || "B").slice(0, 1).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-white sm:text-lg">
                        {barber.name || "Barbeiro"}
                      </h3>
                    </div>
                  </div>

                  <span className="shrink-0 text-lg text-zinc-500">+</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-subpanel p-4">
        <h2 className="text-xl font-bold text-white">Convites pendentes</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Acessos enviados que ainda não foram confirmados.
        </p>
        <div className="mt-4">
          {pendingBarbers.length === 0 ? (
            <EmptyState
              title="Nenhum convite pendente"
              description="Quando você enviar um novo convite, ele aparecerá aqui até a confirmação."
            />
          ) : (
            <div className="space-y-3">
              {pendingBarbers.map((barber) => (
                <div
                  key={barber.id}
                  className="rounded-[24px] border border-[var(--brand)]/20 bg-[linear-gradient(180deg,var(--panel-bg-strong),rgba(18,24,39,0.90))] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {barber.name}
                    </h3>
                    <StatusBadge variant="warning">
                      Pendente de confirmação
                    </StatusBadge>
                  </div>
                  <p className="mt-2 break-all text-sm text-zinc-300">
                    {barber.email}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {formatBrazilianPhone(barber.phone) ||
                      "Telefone não informado"}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Expira em{" "}
                    {new Date(barber.expiresAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-subpanel p-4">
        <h2 className="text-xl font-bold text-white">
          Cadastrar novo barbeiro
        </h2>
        {barberLimitReached ? (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
            Limite de barbeiros atingido. Para cadastrar outro profissional,
            remova um convite pendente, inative alguem ou aumente o plano no
            suporte.
          </div>
        ) : null}
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;

            runAction(
              "create-barber",
              createBarberAction,
              new FormData(form),
              () => form.reset(),
            );
          }}
        >
          <label className="space-y-2 text-sm font-medium text-zinc-300">
            <span>Nome</span>
            <input
              name="name"
              type="text"
              required
              maxLength={120}
              className="form-control"
              placeholder="Ex.: Lucas Barber"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-zinc-300">
            <span>E-mail</span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className="form-control"
              placeholder="barbeiro@jakbarber.com"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-zinc-300">
            <span>Senha inicial</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              maxLength={128}
              className="form-control"
              placeholder="Minimo de 6 caracteres"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-zinc-300">
            <span>Telefone</span>
            <PhoneInput name="phone" className="form-control" />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={barberLimitReached || (isPending && pendingKey === "create-barber")}
              className="btn-primary w-full sm:w-auto"
            >
              {isPending && pendingKey === "create-barber"
                ? "Enviando..."
                : "Enviar acesso"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
