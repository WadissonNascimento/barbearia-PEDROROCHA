"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarOff,
  ChevronDown,
  ListChecks,
  Plus,
  Repeat2,
  Trash2,
} from "lucide-react";
import FeedbackMessage from "@/components/FeedbackMessage";
import EmptyState from "@/components/ui/EmptyState";
import ExclusiveDetails from "@/components/ui/ExclusiveDetails";
import {
  PremiumDateTimePicker,
  PremiumTimePicker,
} from "@/components/ui/PremiumFilters";
import SectionCard from "@/components/ui/SectionCard";
import { weekDays } from "@/lib/barberSchedule";
import { WeeklyAvailabilityForm } from "./WeeklyAvailabilityForm";
import {
  createBarberBlockAction,
  createRecurringBarberBlockAction,
  deleteBarberBlockAction,
  deleteRecurringBarberBlockAction,
  saveBarberAvailabilityAction,
  updateRecurringBarberBlockAction,
} from "../actions";
import type { getBarberDashboardData } from "../data";

type BarberDashboardData = Awaited<ReturnType<typeof getBarberDashboardData>>;
type AvailabilityMutationAction = (formData: FormData) => Promise<{
  ok: boolean;
  message: string;
  tone: "success" | "error" | "info";
}>;

function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MobilePanel({
  title,
  description,
  icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <ExclusiveDetails
      group="barber-availability-panels"
      open={defaultOpen}
      className="group rounded-[26px] border border-white/10 bg-black/20 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--brand-strong)]">
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold text-white">
              {title}
            </span>
            <span className="mt-1 block text-sm leading-5 text-zinc-400">
              {description}
            </span>
          </span>
        </div>

        <span className="flex shrink-0 items-center gap-2">
          {typeof count === "number" ? (
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-bold text-zinc-200">
              {count}
            </span>
          ) : null}
          <ChevronDown className="h-5 w-5 text-zinc-400 transition group-open:rotate-180" />
        </span>
      </summary>

      <div className="border-t border-white/10 p-4 pt-4 sm:p-5">{children}</div>
    </ExclusiveDetails>
  );
}

export function AvailabilitySection({
  availabilities,
  blocks,
  recurringBlocks,
  targetBarberId,
  saveAvailabilityAction = saveBarberAvailabilityAction,
  createBlockAction = createBarberBlockAction,
  createRecurringBlockAction = createRecurringBarberBlockAction,
  deleteBlockAction = deleteBarberBlockAction,
  updateRecurringBlockAction = updateRecurringBarberBlockAction,
  deleteRecurringBlockAction = deleteRecurringBarberBlockAction,
  allowOneOffBlocks = false,
}: {
  availabilities: BarberDashboardData["availabilities"];
  blocks: BarberDashboardData["blocks"];
  recurringBlocks: BarberDashboardData["recurringBlocks"];
  targetBarberId?: string;
  saveAvailabilityAction?: AvailabilityMutationAction;
  createBlockAction?: AvailabilityMutationAction;
  createRecurringBlockAction?: AvailabilityMutationAction;
  deleteBlockAction?: AvailabilityMutationAction;
  updateRecurringBlockAction?: AvailabilityMutationAction;
  deleteRecurringBlockAction?: AvailabilityMutationAction;
  allowOneOffBlocks?: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(
    key: string,
    action: AvailabilityMutationAction,
    formData: FormData,
    onSuccess?: () => void,
  ) {
    if (targetBarberId) {
      formData.set("barberId", targetBarberId);
    }

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
    <SectionCard title="Central de disponibilidade" className="rounded-[30px]">
      <div className="space-y-4">
        <FeedbackMessage message={feedback.message} tone={feedback.tone} />

        <WeeklyAvailabilityForm
          availabilities={availabilities}
          blocks={blocks}
          recurringBlocks={recurringBlocks}
          savingWeekDay={
            pendingKey?.startsWith("availability-day-")
              ? Number(pendingKey.replace("availability-day-", ""))
              : null
          }
          onSaveDay={(formData) =>
            runAction(
              `availability-day-${String(formData.get("weekDay") || "")}`,
              saveAvailabilityAction,
              formData,
            )
          }
          savingRecurringBlockId={
            pendingKey?.startsWith("recurring-block-")
              ? pendingKey.replace("recurring-block-", "")
              : null
          }
          onUpdateRecurringBlock={(formData) =>
            runAction(
              `recurring-block-${String(formData.get("recurringBlockId") || "")}`,
              updateRecurringBlockAction,
              formData,
            )
          }
          onDeleteRecurringBlock={(formData) =>
            runAction(
              `recurring-block-${String(formData.get("recurringBlockId") || "")}`,
              deleteRecurringBlockAction,
              formData,
            )
          }
        />

        {allowOneOffBlocks ? (
          <MobilePanel
            title="Bloquear período"
            description="Folga, almoço, curso ou pausa de um dia específico."
            icon={<Plus className="h-5 w-5" />}
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;

                runAction(
                  "create-block",
                  createBlockAction,
                  new FormData(form),
                  () => form.reset(),
                );
              }}
            >
              <PremiumDateTimePicker
                name="startDateTime"
                label="Início"
                required
              />
              <PremiumDateTimePicker name="endDateTime" label="Fim" required />

              <label className="block">
                <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Motivo
                </span>
                <input
                  name="reason"
                  placeholder="Ex.: almoço, curso, folga"
                  className="min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/60"
                />
              </label>

              <button
                type="submit"
                disabled={isPending && pendingKey === "create-block"}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CalendarOff className="h-4 w-4" />
                {isPending && pendingKey === "create-block"
                  ? "Bloqueando..."
                  : "Bloquear horário"}
              </button>
            </form>
          </MobilePanel>
        ) : null}

        <MobilePanel
          title="Pausa fixa semanal"
          description="Almoço, intervalo ou bloqueio que se repete toda semana."
          icon={<Repeat2 className="h-5 w-5" />}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;

              runAction(
                "recurring-block",
                createRecurringBlockAction,
                new FormData(form),
                () => form.reset(),
              );
            }}
          >
            <label className="block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Dia da semana
              </span>
              <select
                name="weekDay"
                defaultValue=""
                required
                className="min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand)]/60"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {weekDays.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Início
                </span>
                <PremiumTimePicker name="startTime" required />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Fim
                </span>
                <PremiumTimePicker name="endTime" required />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Motivo
              </span>
              <input
                name="reason"
                placeholder="Ex.: almoço fixo"
                className="min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/60"
              />
            </label>

            <button
              type="submit"
              disabled={isPending && pendingKey === "recurring-block"}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Repeat2 className="h-4 w-4" />
              {isPending && pendingKey === "recurring-block"
                ? "Criando..."
                : "Criar pausa fixa"}
            </button>
          </form>
        </MobilePanel>

        {allowOneOffBlocks ? (
          <MobilePanel
            title="Bloqueios futuros"
            description="Pausas pontuais já cadastradas."
            icon={<ListChecks className="h-5 w-5" />}
            count={blocks.length}
          >
            <div className="space-y-3">
              {blocks.length === 0 ? (
                <EmptyState
                  title="Nenhum bloqueio futuro"
                  description="Quando você criar uma folga ou pausa pontual, ela aparece aqui."
                />
              ) : (
                blocks.map((block) => (
                  <div
                    key={block.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {formatDateTime(block.startDateTime)} até{" "}
                          {formatDateTime(block.endDateTime)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {block.reason || "Sem motivo informado"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={
                          isPending && pendingKey === `block-${block.id}`
                        }
                        onClick={() => {
                          if (
                            !window.confirm("Remover este bloqueio de horário?")
                          ) {
                            return;
                          }

                          const formData = new FormData();
                          formData.set("blockId", block.id);
                          runAction(
                            `block-${block.id}`,
                            deleteBlockAction,
                            formData,
                          );
                        }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/35 text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Remover bloqueio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MobilePanel>
        ) : null}
      </div>
    </SectionCard>
  );
}
