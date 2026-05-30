"use client";

import { useEffect, useState } from "react";
import {
  Clock3,
  Moon,
  PauseCircle,
  Pencil,
  Save,
  SunMedium,
  Trash2,
  X,
} from "lucide-react";
import { PremiumTimePicker } from "@/components/ui/PremiumFilters";
import { weekDays } from "@/lib/barberSchedule";

type WeeklyAvailabilityFormProps = {
  availabilities: Array<{
    weekDay: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
  blocks: Array<{
    id: string;
    startDateTime: Date | string;
    endDateTime: Date | string;
    reason: string | null;
  }>;
  recurringBlocks: Array<{
    id: string;
    weekDay: number;
    startTime: string;
    endTime: string;
    reason: string | null;
  }>;
  onSaveDay: (formData: FormData) => void;
  onUpdateRecurringBlock: (formData: FormData) => void;
  onDeleteRecurringBlock: (formData: FormData) => void;
  savingWeekDay?: number | null;
  savingRecurringBlockId?: string | null;
};

type DayState = {
  weekDay: number;
  label: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

function formatBlockTime(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDays(
  availabilities: WeeklyAvailabilityFormProps["availabilities"],
) {
  const availabilityMap = new Map(
    availabilities.map((item) => [item.weekDay, item] as const),
  );

  return weekDays.map((day) => ({
    weekDay: day.value,
    label: day.label,
    startTime: availabilityMap.get(day.value)?.startTime || "08:00",
    endTime: availabilityMap.get(day.value)?.endTime || "18:00",
    isActive: availabilityMap.get(day.value)?.isActive ?? false,
  }));
}

export function WeeklyAvailabilityForm({
  availabilities,
  blocks,
  recurringBlocks,
  onSaveDay,
  onUpdateRecurringBlock,
  onDeleteRecurringBlock,
  savingWeekDay = null,
  savingRecurringBlockId = null,
}: WeeklyAvailabilityFormProps) {
  const [days, setDays] = useState<DayState[]>(() => buildDays(availabilities));
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingRecurringBlockId, setEditingRecurringBlockId] = useState<
    string | null
  >(null);

  useEffect(() => {
    setDays(buildDays(availabilities));
  }, [availabilities]);

  function updateDay(
    weekDay: number,
    patch: Partial<Pick<DayState, "startTime" | "endTime" | "isActive">>,
  ) {
    setDays((current) =>
      current.map((day) =>
        day.weekDay === weekDay ? { ...day, ...patch } : day,
      ),
    );
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex min-w-0 items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
          <Clock3 className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-bold text-white">
            Horarios de atendimento
          </span>
          <span className="mt-1 block text-sm leading-5 text-zinc-400">
            Edite e salve cada dia separadamente.
          </span>
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {days.map((day) => {
          const isEditing = editingDay === day.weekDay;
          const isSaving = savingWeekDay === day.weekDay;
          const dayRecurringBlocks = recurringBlocks.filter(
            (block) => block.weekDay === day.weekDay,
          );
          const dayBlocks = blocks.filter(
            (block) => new Date(block.startDateTime).getDay() === day.weekDay,
          );
          const pausesCount = dayRecurringBlocks.length + dayBlocks.length;

          return (
            <form
              key={day.weekDay}
              className={`rounded-3xl border p-4 transition ${
                isEditing
                  ? "border-[var(--brand)]/45 bg-[var(--brand-muted)]"
                  : "border-white/10 bg-white/[0.045]"
              }`}
              onSubmit={(event) => {
                event.preventDefault();
                onSaveDay(new FormData(event.currentTarget));
                setEditingDay(null);
              }}
            >
              <input type="hidden" name="weekDay" value={day.weekDay} />
              <input
                type="hidden"
                name="isActive"
                value={day.isActive ? "true" : "false"}
              />

              <div className="flex flex-col gap-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-white">{day.label}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-zinc-400">
                      <Clock3 className="h-4 w-4 shrink-0" />
                      <span>
                        {day.startTime} ate {day.endTime}
                      </span>
                    </p>
                  </div>

                  <span
                    className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      day.isActive
                        ? "border border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
                        : "border border-red-400/25 bg-red-500/10 text-red-200"
                    }`}
                  >
                    {day.isActive ? (
                      <SunMedium className="h-3 w-3" />
                    ) : (
                      <Moon className="h-3 w-3" />
                    )}
                    {day.isActive ? "Aberto" : "Bloqueado"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm text-zinc-400">
                    {pausesCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-zinc-300">
                        <PauseCircle className="h-4 w-4" />
                        {pausesCount} pausa{pausesCount > 1 ? "s" : ""}
                      </span>
                    ) : (
                      "Sem pausas nesse dia"
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setEditingRecurringBlockId(null);
                      setEditingDay((current) =>
                        current === day.weekDay ? null : day.weekDay,
                      );
                    }}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/5 disabled:opacity-60"
                  >
                    {isEditing ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                    {isEditing ? "Fechar" : "Editar"}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateDay(day.weekDay, { isActive: !day.isActive })
                    }
                    className={`mb-3 min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-bold transition ${
                      day.isActive
                        ? "border-red-400/25 text-red-200 hover:bg-red-500/10"
                        : "border-[var(--brand)]/35 text-[var(--brand-strong)] hover:bg-[var(--brand-muted)]"
                    }`}
                  >
                    {day.isActive ? "Fechar este dia" : "Abrir este dia"}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                        Inicio
                      </span>
                      <PremiumTimePicker
                        name="startTime"
                        value={day.startTime}
                        onChange={(value) =>
                          updateDay(day.weekDay, { startTime: value })
                        }
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                        Fim
                      </span>
                      <PremiumTimePicker
                        name="endTime"
                        value={day.endTime}
                        onChange={(value) =>
                          updateDay(day.weekDay, { endTime: value })
                        }
                        required
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Salvando..." : "Salvar dia"}
                  </button>
                </div>
              ) : null}

              {pausesCount > 0 ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Pausas e bloqueios
                  </p>
                  <div className="mt-2 space-y-2">
                    {dayRecurringBlocks.map((block) => (
                      <RecurringBlockRow
                        key={block.id}
                        block={block}
                        isEditing={editingRecurringBlockId === block.id}
                        isSaving={savingRecurringBlockId === block.id}
                        onEdit={() => {
                          setEditingDay(null);
                          setEditingRecurringBlockId((current) =>
                            current === block.id ? null : block.id,
                          );
                        }}
                        onCancelEdit={() => setEditingRecurringBlockId(null)}
                        onUpdate={(formData) => {
                          onUpdateRecurringBlock(formData);
                          setEditingRecurringBlockId(null);
                        }}
                        onDelete={(formData) => {
                          onDeleteRecurringBlock(formData);
                          setEditingRecurringBlockId(null);
                        }}
                      />
                    ))}
                    {dayBlocks.map((block) => (
                      <p key={block.id} className="text-sm text-zinc-300">
                        Pontual: {formatBlockTime(block.startDateTime)} ate{" "}
                        {formatBlockTime(block.endDateTime)}
                        {block.reason ? ` - ${block.reason}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </form>
          );
        })}
      </div>
    </section>
  );
}

function RecurringBlockRow({
  block,
  isEditing,
  isSaving,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  block: WeeklyAvailabilityFormProps["recurringBlocks"][number];
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (formData: FormData) => void;
  onDelete: (formData: FormData) => void;
}) {
  const [startTime, setStartTime] = useState(block.startTime);
  const [endTime, setEndTime] = useState(block.endTime);
  const [reason, setReason] = useState(block.reason || "");

  useEffect(() => {
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setReason(block.reason || "");
  }, [block.startTime, block.endTime, block.reason]);

  function buildFormData() {
    const formData = new FormData();
    formData.set("recurringBlockId", block.id);
    formData.set("weekDay", String(block.weekDay));
    formData.set("startTime", startTime);
    formData.set("endTime", endTime);
    formData.set("reason", reason);
    return formData;
  }

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-muted)] p-2.5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
          Editar pausa fixa
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Inicio
            </span>
            <PremiumTimePicker
              value={startTime}
              onChange={setStartTime}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Fim
            </span>
            <PremiumTimePicker value={endTime} onChange={setEndTime} required />
          </label>
        </div>

        <label className="mt-2 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            Motivo
          </span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: almoco"
            className="min-h-9 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/60"
          />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onUpdate(buildFormData())}
            disabled={isSaving}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 py-1.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isSaving}
            className="min-h-9 rounded-xl border border-white/10 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-white/5 disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200">
            Fixa: {block.startTime} ate {block.endTime}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {block.reason || "Sem motivo informado"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            disabled={isSaving}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-200 transition hover:bg-white/5 disabled:opacity-60"
            aria-label="Editar pausa fixa"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Remover esta pausa fixa?")) return;
              const formData = new FormData();
              formData.set("recurringBlockId", block.id);
              onDelete(formData);
            }}
            disabled={isSaving}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/30 text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
            aria-label="Remover pausa fixa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
