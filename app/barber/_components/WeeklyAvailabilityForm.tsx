"use client";

import { useState } from "react";
import { Check, Clock3, LoaderCircle, Moon, Trash2 } from "lucide-react";
import { PremiumTimePicker } from "@/components/ui/PremiumFilters";
import { weekDays } from "@/lib/barberSchedule";
import { formatScheduleDate, formatScheduleTime, getScheduleDateValue, getScheduleDayOfWeek } from "@/lib/scheduleTime";
import type { MutationResult } from "@/lib/mutationResult";
import { useAvailabilityAutosave } from "./useAvailabilityAutosave";

type Mutation = (data: FormData) => Promise<MutationResult>;
type Day = { weekDay: number; startTime: string; endTime: string; isActive: boolean };
type Pause = { id: string; weekDay: number; startTime: string; endTime: string; reason: string | null };
type Block = { id: string; startDateTime: Date | string; endDateTime: Date | string; reason: string | null };
type Props = {
  availabilities: Day[];
  blocks: Block[];
  recurringBlocks: Pause[];
  onSaveDay: Mutation;
  onUpdateRecurringBlock: Mutation;
  onDeleteRecurringBlock: Mutation;
};
const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-base text-white outline-none focus:border-white/60 focus:ring-2 focus:ring-white/15 [color-scheme:dark]";

function validateRange(value: { startTime: string; endTime: string }) {
  return /^\d{2}:\d{2}$/.test(value.startTime) && /^\d{2}:\d{2}$/.test(value.endTime) && value.startTime < value.endTime
    ? null : "O fim precisa ser depois do início.";
}

function SaveStatus({ status, error, retry }: { status: string; error: boolean; retry: () => void }) {
  return <div className={`mt-3 flex min-h-6 flex-wrap items-center gap-2 text-xs ${error ? "text-red-300" : "text-zinc-400"}`} role={error ? "alert" : "status"} aria-live="polite">
    {status === "Salvo" ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : status === "Salvando…" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
    <span>{status}</span>
    {error ? <button type="button" onClick={retry} className="min-h-9 underline underline-offset-4">Tentar novamente</button> : null}
  </div>;
}

function PauseRow({ block, onUpdate, onDelete }: { block: Pause; onUpdate: Mutation; onDelete: Mutation }) {
  const save = useAvailabilityAutosave({ recurringBlockId: block.id, weekDay: block.weekDay, startTime: block.startTime, endTime: block.endTime, reason: block.reason || "" }, onUpdate, validateRange);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  return <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
    <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold text-zinc-300">Pausa semanal</p>
      <button type="button" disabled={deleting || save.status === "Salvando…" || save.status === "Alterações pendentes…"} aria-label="Remover pausa semanal" onClick={() => setConfirmDelete(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
    </div>
    <fieldset disabled={deleting} className="grid grid-cols-2 gap-3">
      <PremiumTimePicker label="Início da pausa" value={save.value.startTime} onChange={startTime => save.update({ startTime })} disabled={deleting} />
      <PremiumTimePicker label="Fim da pausa" value={save.value.endTime} onChange={endTime => save.update({ endTime })} disabled={deleting} />
      <label className="col-span-2 text-xs text-zinc-400">Motivo (opcional)<input value={save.value.reason} onChange={e => save.update({ reason: e.target.value })} placeholder="Ex.: almoço" className={`${inputClass} mt-1`} /></label>
    </fieldset>
    <SaveStatus {...save} />
    {confirmDelete ? <div className="mt-2 rounded-xl border border-red-400/20 p-3 text-sm"><p>Remover esta pausa semanal?</p><div className="mt-2 flex gap-3">
      <button type="button" disabled={deleting} className="min-h-10 rounded-lg bg-red-500/15 px-3 text-red-200" onClick={async () => {
        setDeleting(true); setDeleteError("");
        const data = new FormData(); data.set("recurringBlockId", block.id);
        try { const result = await onDelete(data); if (!result.ok) setDeleteError(result.message); else setConfirmDelete(false); }
        catch { setDeleteError("Não foi possível remover a pausa."); }
        finally { setDeleting(false); }
      }}>{deleting ? "Removendo…" : "Remover"}</button>
      <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)} className="min-h-10 px-3">Manter pausa</button>
    </div></div> : null}
    {deleteError ? <p role="alert" className="mt-2 text-sm text-red-300">{deleteError}</p> : null}
  </div>;
}

function DayRow({ initial, label, pauses, blocks, onSaveDay, onUpdateRecurringBlock, onDeleteRecurringBlock }: { initial: Day; label: string; pauses: Pause[]; blocks: Block[] } & Pick<Props, "onSaveDay" | "onUpdateRecurringBlock" | "onDeleteRecurringBlock">) {
  const save = useAvailabilityAutosave(initial, onSaveDay, validateRange);
  const day = save.value;
  return <article className={`rounded-2xl border p-4 transition ${day.isActive ? "border-white/15 bg-white/[0.035]" : "border-white/5 bg-black/15"}`}>
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="text-base font-bold text-white">{label}</h3><p className="mt-1 text-xs text-zinc-400">{day.isActive ? "Disponível para agendar" : "Dia de folga"}</p></div>
      <button type="button" role="switch" aria-checked={day.isActive} aria-label={`Atendimento ${label}`} onClick={() => save.update({ isActive: !day.isActive })} className="flex min-h-11 items-center gap-2 rounded-xl px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <span className="text-xs text-zinc-300">{day.isActive ? "Aberto" : "Fechado"}</span>
        <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${day.isActive ? "bg-emerald-500" : "bg-zinc-700"}`}><span className={`h-5 w-5 rounded-full shadow transition-transform ${day.isActive ? "translate-x-5 bg-white" : "bg-zinc-400"}`} /></span>
      </button>
    </div>
    {day.isActive ? <div className="mt-4 grid grid-cols-2 gap-3">
      <PremiumTimePicker label="Abre às" value={day.startTime} onChange={startTime => save.update({ startTime })} />
      <PremiumTimePicker label="Fecha às" value={day.endTime} onChange={endTime => save.update({ endTime })} />
    </div> : <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500"><Moon className="h-4 w-4" />Sem atendimento neste dia.</p>}
    <SaveStatus {...save} />
    {pauses.map(block => <PauseRow key={block.id} block={block} onUpdate={onUpdateRecurringBlock} onDelete={onDeleteRecurringBlock} />)}
    {blocks.map(block => <p key={block.id} className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-5 text-zinc-400">Bloqueio em {formatScheduleDate(new Date(block.startDateTime), { day: "2-digit", month: "2-digit" })}, {formatScheduleTime(new Date(block.startDateTime))} até {formatScheduleDate(new Date(block.endDateTime), { day: "2-digit", month: "2-digit" })}, {formatScheduleTime(new Date(block.endDateTime))}{block.reason ? ` · ${block.reason}` : ""}</p>)}
  </article>;
}

export function WeeklyAvailabilityForm({ availabilities, blocks, recurringBlocks, ...actions }: Props) {
  return <section>
    <div className="mb-5 flex items-start gap-3"><Clock3 className="mt-1 h-5 w-5 shrink-0 text-zinc-300" /><div><h2 className="text-lg font-bold text-white">Sua semana de trabalho</h2><p className="mt-1 text-sm leading-6 text-zinc-400">Ative os dias e ajuste os horários. As alterações são salvas automaticamente, sem precisar confirmar.</p></div></div>
    <div className="grid gap-3 lg:grid-cols-2">{weekDays.map(day => <DayRow key={day.value} label={day.label} initial={availabilities.find(item => item.weekDay === day.value) || { weekDay: day.value, startTime: "09:00", endTime: "18:00", isActive: false }} pauses={recurringBlocks.filter(block => block.weekDay === day.value)} blocks={blocks.filter(block => getScheduleDayOfWeek(getScheduleDateValue(new Date(block.startDateTime))) === day.value)} {...actions} />)}</div>
  </section>;
}
