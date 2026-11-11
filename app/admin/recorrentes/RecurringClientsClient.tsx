"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, CalendarDays, Check, ChevronDown, Infinity as InfinityIcon, LoaderCircle, PencilLine, Repeat2, Search, UserRound, X } from "lucide-react";
import { PremiumDatePicker, PremiumTimePicker } from "@/components/ui/PremiumFilters";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import type { RecurringSeriesSummary } from "@/lib/recurringSeriesTypes";
import { cancelCustomerRecurringSeriesAction, cancelRecurringSeriesAction, cancelRecurringVisitAction, loadRecurringHistoryAction, rescheduleRecurringVisitAction, retryRecurringSeriesAction } from "./actions";

type Visit = RecurringSeriesSummary["appointments"][number];
type DialogState =
  | { kind: "series"; series: RecurringSeriesSummary }
  | { kind: "customer"; series: RecurringSeriesSummary }
  | { kind: "cancel"; series: RecurringSeriesSummary; visit: Visit }
  | { kind: "reschedule"; series: RecurringSeriesSummary; visit: Visit };
const dateLabel = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const statusLabels: Record<string, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };

export default function RecurringClientsClient({ series }: { series: RecurringSeriesSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [feedback, setFeedback] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);
  const activeCount = series.filter((item) => item.status === "ACTIVE").length;
  const upcomingCount = series.reduce((sum, item) => sum + item.futureCount, 0);
  const conflictCount = series.reduce((sum, item) => sum + item.conflicts.length, 0);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const matches = series.filter((item) => (filter === "all" || (filter === "active" ? item.status === "ACTIVE" : item.status !== "ACTIVE")) && `${item.customerName} ${item.barberName} ${item.serviceNames.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery));

  async function retry(item: RecurringSeriesSummary) {
    if (retrying) return;
    setRetrying(item.batchKey);
    const result = await retryRecurringSeriesAction({ batchKey: item.batchKey });
    setRetrying(null);
    if (!result.ok) { setFeedback(result.message); return; }
    setFeedback("Disponibilidade verificada. Os horários livres foram incluídos na agenda.");
    router.refresh();
  }

  return <div className="space-y-5">
    <div className="grid grid-cols-3 gap-2 sm:gap-4">{[{ label: "Recorrências ativas", value: activeCount, icon: Repeat2 }, { label: "Próximas visitas", value: upcomingCount, icon: CalendarDays }, { label: "Para revisar", value: conflictCount, icon: AlertCircle }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4"><Icon size={18} className={label === "Para revisar" && value ? "text-amber-300" : "text-zinc-400"} /><p className="mt-2 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-[11px] leading-4 text-zinc-400 sm:text-sm">{label}</p></div>)}</div>
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:flex-row sm:items-center"><label className="relative block min-w-0 flex-1"><span className="sr-only">Buscar recorrência</span><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input type="search" inputMode="text" autoComplete="off" placeholder="Buscar cliente, barbeiro ou serviço" value={query} onChange={(event) => setQuery(event.target.value)} className="form-control w-full !pl-10" /></label><div className="flex gap-1 rounded-xl bg-black/25 p-1">{[{ value: "active", label: "Ativas" }, { value: "ended", label: "Encerradas" }, { value: "all", label: "Todas" }].map((option) => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)} className={`min-h-10 flex-1 rounded-lg px-3 text-sm ${filter === option.value ? "bg-white/15 text-white" : "text-zinc-400"}`}>{option.label}</button>)}</div></div>
    {feedback && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200"><Check size={18} />{feedback}</p>}
    <div className="space-y-4">{matches.map((item) => <SeriesCard key={item.batchKey} series={item} onDialog={setDialog} onRetry={() => void retry(item)} retrying={retrying === item.batchKey} retryDisabled={Boolean(retrying)} />)}</div>
    {!matches.length && <div className="rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center"><Repeat2 size={30} className="mx-auto text-zinc-500" /><h2 className="mt-4 text-lg font-semibold text-white">{query ? "Nenhuma recorrência encontrada" : "Nenhuma recorrência neste filtro"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">Use Agendamento recorrente na agenda para reservar os horários dos clientes fixos.</p></div>}
    {dialog && createPortal(<ManageDialog state={dialog} onClose={() => setDialog(null)} onSuccess={(message) => { setFeedback(message); setDialog(null); router.refresh(); }} />, document.body)}
  </div>;
}

function SeriesCard({ series, onDialog, onRetry, retrying, retryDisabled }: { series: RecurringSeriesSummary; onDialog: (state: DialogState) => void; onRetry: () => void; retrying: boolean; retryDisabled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [olderHistory, setOlderHistory] = useState<Visit[]>([]);
  const [cursor, setCursor] = useState(series.historyCursor);
  const [hasMore, setHasMore] = useState(series.hasMoreHistory);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const listId = useId();
  const interval = series.intervalDays === 7 ? "Toda semana" : series.intervalDays === 14 ? "A cada 2 semanas" : series.intervalDays === 15 ? "A cada 15 dias" : "Datas escolhidas";
  async function loadHistory() {
    if (!cursor || historyBusy) return;
    setHistoryBusy(true); setHistoryError("");
    const result = await loadRecurringHistoryAction({ batchKey: series.batchKey, before: cursor });
    setHistoryBusy(false);
    if (!result.ok) { setHistoryError(result.message); return; }
    setOlderHistory((current) => [...current, ...result.data.appointments.filter((visit) => !current.some((item) => item.id === visit.id))]); setCursor(result.data.historyCursor); setHasMore(result.data.hasMoreHistory);
  }
  const upcoming = series.appointments.filter((visit) => visit.canEdit);
  const history = [...series.appointments.filter((visit) => !visit.canEdit), ...olderHistory].filter((visit, index, list) => list.findIndex((item) => item.id === visit.id) === index).sort((a, b) => b.date.localeCompare(a.date));
  const visits = showHistory ? history : upcoming;
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#171717]"><div className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300"><UserRound size={21} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-lg font-bold text-white">{series.customerName}</h2><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${series.status === "ACTIVE" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-zinc-400"}`}>{series.status === "CANCELLED" ? "Cancelada" : series.status === "FINISHED" ? "Encerrada" : series.repeatForever ? <><InfinityIcon size={12} className="mr-1 inline" />Sempre</> : "Ativa"}</span>{series.useVipPlan && <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase text-amber-200">Plano {series.vipPlanName || "VIP"}</span>}</div><p className="mt-1 break-words text-sm text-zinc-400">{series.barberName} · {series.serviceNames.join(" + ") || series.vipPlanName || "Item do plano"}</p></div></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/5 pt-3 text-xs text-zinc-400"><p className="flex items-center gap-1.5"><Repeat2 size={14} />{interval}{series.time ? ` às ${series.time}` : ""}</p><p className="flex items-center gap-1.5"><CalendarClock size={14} />{series.nextDate ? `Próxima: ${dateLabel(series.nextDate)}` : "Sem próximas visitas"}</p></div>
      {series.conflicts.length > 0 && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-amber-200"><AlertCircle size={16} />{series.conflicts.length} horário(s) precisam de ajuste</p><ul className="mt-2 space-y-1 text-xs text-amber-100/90">{series.conflicts.map((conflict) => <li key={`${conflict.date}-${conflict.time}`}>{dateLabel(conflict.date)} às {conflict.time} · {conflict.message}</li>)}</ul><button type="button" onClick={onRetry} disabled={retryDisabled} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-amber-200 underline">{retrying && <LoaderCircle size={15} className="animate-spin" />}{retrying ? "Verificando..." : "Verificar disponibilidade novamente"}</button></div>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((value) => !value)} className="btn-secondary gap-2 text-sm"><CalendarDays size={16} />{expanded ? "Recolher visitas" : `Ver agendamentos (${series.futureCount})`}<ChevronDown size={16} className={expanded ? "rotate-180" : ""} /></button>{series.status === "ACTIVE" && <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center"><button type="button" onClick={() => onDialog({ kind: "series", series })} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-rose-300"><X size={16} />Cancelar esta recorrência</button>{series.customerId && <button type="button" onClick={() => onDialog({ kind: "customer", series })} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs text-rose-300/75 sm:border-l sm:border-white/10 sm:pl-3">Cancelar recorrências do cliente</button>}</div>}</div></div>
    {expanded && <div id={listId} className="border-t border-white/10 bg-black/15 p-3 sm:p-5"><div className="mb-3 flex gap-4 border-b border-white/10"><button type="button" onClick={() => setShowHistory(false)} className={`min-h-11 border-b-2 px-1 text-sm ${!showHistory ? "border-white font-semibold text-white" : "border-transparent text-zinc-500"}`}>Próximas ({upcoming.length})</button><button type="button" onClick={() => setShowHistory(true)} className={`min-h-11 border-b-2 px-1 text-sm ${showHistory ? "border-white font-semibold text-white" : "border-transparent text-zinc-500"}`}>Histórico ({history.length})</button></div><ul className="space-y-2">{visits.map((visit) => <li key={visit.id} className="flex flex-col gap-3 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-white">{dateLabel(visit.dateValue)} <span className="text-base">{visit.time}</span></p><p className="mt-1 text-xs text-zinc-400">{visit.serviceNames.join(" + ") || series.vipPlanName || "Item do plano"} · {visit.barberName}</p><p className="mt-1 text-xs text-zinc-500">{statusLabels[visit.status] || visit.status}</p></div>{visit.canEdit && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onDialog({ kind: "reschedule", series, visit })} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-white/15 px-3 text-xs font-semibold"><PencilLine size={14} />Alterar</button><button type="button" onClick={() => onDialog({ kind: "cancel", series, visit })} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-rose-400/20 px-3 text-xs text-rose-300"><X size={14} />Cancelar</button></div>}</li>)}</ul>{!visits.length && <p className="py-5 text-center text-sm text-zinc-500">{showHistory ? "Ainda não há histórico." : "Não há visitas futuras reservadas."}</p>}{showHistory && hasMore && <button type="button" disabled={historyBusy} onClick={() => void loadHistory()} className="btn-secondary mt-3 w-full">{historyBusy ? "Carregando..." : "Carregar histórico anterior"}</button>}{historyError && <p role="alert" className="mt-2 text-sm text-red-300">{historyError}</p>}</div>}
  </article>;
}

function ManageDialog({ state, onClose, onSuccess }: { state: DialogState; onClose: () => void; onSuccess: (message: string) => void }) {
  const [date, setDate] = useState(state.kind === "cancel" || state.kind === "reschedule" ? state.visit.dateValue : "");
  const [time, setTime] = useState(state.kind === "cancel" || state.kind === "reschedule" ? state.visit.time : "09:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const edit = state.kind === "reschedule";
  async function submit() {
    setBusy(true); setError("");
    try {
      let result;
      if (state.kind === "series") {
        result = await cancelRecurringSeriesAction({ batchKey: state.series.batchKey });
      } else if (state.kind === "customer") {
        result = await cancelCustomerRecurringSeriesAction({ customerId: state.series.customerId });
      } else if (state.kind === "cancel") {
        result = await cancelRecurringVisitAction({ appointmentId: state.visit.id });
      } else {
        result = await rescheduleRecurringVisitAction({ appointmentId: state.visit.id, date, time });
      }
      if (!result.ok) { setError(result.message); return; }
      onSuccess(state.kind === "series" ? `Recorrência de ${state.series.customerName} cancelada. O histórico foi preservado.` : state.kind === "customer" ? `Todas as recorrências ativas de ${state.series.customerName} foram canceladas.` : state.kind === "cancel" ? "Visita cancelada. Os outros horários continuam agendados." : "Horário alterado. As outras visitas continuam iguais.");
    } catch { setError("Não foi possível confirmar a alteração. Confira a agenda e tente novamente."); }
    finally { setBusy(false); }
  }
  const isBulkCustomerCancel = state.kind === "customer";
  return <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-3"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#171717] text-white shadow-2xl"><header className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5"><div><p className="text-xs uppercase tracking-widest text-zinc-500">{state.series.customerName}</p><h2 className="mt-2 text-xl font-bold">{edit ? "Alterar este horário" : state.kind === "customer" ? "Cancelar todas as recorrências?" : state.kind === "series" ? "Cancelar toda a recorrência?" : "Cancelar esta visita?"}</h2></div><button type="button" aria-label="Fechar" disabled={busy} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"><X size={20} /></button></header><div className="space-y-4 p-4 sm:p-5">{state.kind === "cancel" || state.kind === "reschedule" ? <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{dateLabel(state.visit.dateValue)} às {state.visit.time}</p> : null}{edit ? <><p className="text-sm text-zinc-400">A disponibilidade será validada antes de salvar. O restante da série continua igual.</p><div className="grid gap-3 sm:grid-cols-2"><PremiumDatePicker label="Nova data" value={date} onChange={setDate} min={getCurrentScheduleDateValue()} /><PremiumTimePicker label="Novo horário" value={time} onChange={setTime} /></div></> : state.kind === "customer" ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm leading-6 text-rose-100"><strong>Todas as recorrências ativas de {state.series.customerName} serão canceladas.</strong><p className="mt-2">As visitas futuras serão canceladas, novas visitas deixarão de ser criadas e o histórico passado será preservado.</p></div> : state.kind === "series" ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm leading-6 text-rose-100"><strong>{state.series.futureCount} visita(s) futura(s) serão canceladas.</strong><p className="mt-2">Novas visitas deixarão de ser criadas. Os atendimentos anteriores continuam no histórico.</p></div> : <p className="text-sm leading-6 text-zinc-300">Somente esta visita será cancelada. A série e os demais horários continuam.</p>}{error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}</div><footer className="flex flex-col-reverse gap-2 border-t border-white/10 p-4 sm:flex-row sm:p-5"><button type="button" disabled={busy} onClick={onClose} className="btn-secondary flex-1">Voltar</button><button type="button" disabled={busy || (edit && (!date || !time))} onClick={() => void submit()} className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold ${edit ? "bg-white text-black" : "border border-rose-400/30 bg-rose-400/15 text-rose-100"}`}>{busy ? "Salvando..." : edit ? "Salvar novo horário" : isBulkCustomerCancel ? "Cancelar todas as recorrências" : state.kind === "series" ? "Cancelar toda a recorrência" : "Cancelar esta visita"}</button></footer></div></div>;
}
