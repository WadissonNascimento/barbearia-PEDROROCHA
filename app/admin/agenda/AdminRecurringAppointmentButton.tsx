"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Infinity as InfinityIcon, LoaderCircle, Repeat2, Search, X } from "lucide-react";
import { PremiumDatePicker, PremiumSelect, PremiumTimePicker } from "@/components/ui/PremiumFilters";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import { addRecurringDays, generateRecurringDates, MAX_RECURRING_VISITS, type RecurringPreviewDay } from "@/lib/recurringBooking";
import { formatCurrency } from "@/lib/utils";
import { previewRecurringAppointmentsAction, createRecurringAppointmentsAction } from "./recurringActions";
import { searchRecurringCustomersAction } from "./customerSearchActions";
import type { AdminAgendaBarber, AdminAgendaCustomer, AdminAgendaService } from "./AdminAgendaClient";

const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
function getPlanItemLabel(code: string) {
  if (code === "CORTE") return "Corte";
  if (code.includes("BARBA")) return "Corte, sobrancelha e barba";
  if (code.includes("SOBRANCELHA")) return "Corte e sobrancelha";
  return "Item do plano";
}

export default function AdminRecurringAppointmentButton(props: { barbers: AdminAgendaBarber[]; customers: AdminAgendaCustomer[]; services: AdminAgendaService[]; selectedBarberId?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="btn-secondary w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}><Repeat2 size={18} aria-hidden="true" />Agendamento recorrente</button>
    {open && createPortal(<RecurringForm {...props} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

function RecurringForm({ barbers, customers, services, selectedBarberId, onClose }: { barbers: AdminAgendaBarber[]; customers: AdminAgendaCustomer[]; services: AdminAgendaService[]; selectedBarberId?: string; onClose: () => void }) {
  const router = useRouter();
  const today = getCurrentScheduleDateValue();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [customerMode, setCustomerMode] = useState<"registered" | "guest">("registered");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<AdminAgendaCustomer | null>(null);
  const customerId = selectedCustomer?.id || "";
  const [matches, setMatches] = useState<AdminAgendaCustomer[]>(customers.slice(0, 40));
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(customers.length);
  const [hasMore, setHasMore] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchVersion = useRef(0);
  const [barberId, setBarberId] = useState(barbers.some((barber) => barber.id === selectedBarberId) ? selectedBarberId! : barbers[0]?.id || "");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [useVipPlan, setUseVipPlan] = useState(false);
  const [mode, setMode] = useState("7");
  const [start, setStart] = useState(today);
  const [count, setCount] = useState("4");
  const [repeatForever, setRepeatForever] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [commonTime, setCommonTime] = useState("09:00");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<RecurringPreviewDay[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<number | null>(null);
  const lock = useRef(false);
  const requestId = useRef("");
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    requestId.current = crypto.randomUUID();
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step, success]);

  useEffect(() => {
    const version = ++searchVersion.current;
    if (customerMode !== "registered") return;
    setSearchBusy(true);
    setSearchError("");
    const timeout = window.setTimeout(async () => {
      try {
        const result = await searchRecurringCustomersAction({ query, page: 1 });
        if (searchVersion.current !== version) return;
        if (!result.ok) { setSearchError(result.message); setMatches([]); setHasMore(false); return; }
        setMatches(result.data.customers); setSearchPage(result.data.page); setSearchTotal(result.data.total); setHasMore(result.data.hasMore);
      } catch { if (searchVersion.current === version) setSearchError("Não foi possível buscar os clientes. Tente novamente."); }
      finally { if (searchVersion.current === version) setSearchBusy(false); }
    }, 250);
    return () => { window.clearTimeout(timeout); searchVersion.current += 1; };
  }, [query, customerMode]);

  async function loadMoreCustomers() {
    if (searchBusy || !hasMore) return;
    const version = searchVersion.current;
    setSearchBusy(true); setSearchError("");
    try {
      const result = await searchRecurringCustomersAction({ query, page: searchPage + 1 });
      if (searchVersion.current !== version) return;
      if (!result.ok) { setSearchError(result.message); return; }
      setMatches((current) => [...current, ...result.data.customers.filter((customer) => !current.some((item) => item.id === customer.id))]);
      setSearchPage(result.data.page); setSearchTotal(result.data.total); setHasMore(result.data.hasMore);
    } catch { if (searchVersion.current === version) setSearchError("Não foi possível carregar mais clientes. Tente novamente."); }
    finally { if (searchVersion.current === version) setSearchBusy(false); }
  }

  const guest = customerMode === "guest";
  const customerValid = guest ? customerName.trim().length >= 2 && !/[|\r\n]/.test(customerName) : Boolean(customerId);
  const customerPayload = guest ? { customerName: customerName.trim(), customerPhone: customerPhone.trim() || undefined } : { customerId };
  const customerPlan = selectedCustomer?.vipPlan || selectedCustomer?.vipSubscription?.plan || null;
  const availableServices = services.filter((service) => !service.barberId || service.barberId === barberId);
  const selectedServices = availableServices.filter((service) => serviceIds.includes(service.id));
  const price = selectedServices.reduce((total, service) => total + service.price, 0);
  const duration = selectedServices.reduce((total, service) => total + service.duration, 0);
  const allAvailable = preview.length === dates.length && preview.length >= 2 && preview.every((day) => day.slots.includes(times[day.date]));

  function setDateList(next: string[]) { setDates([...new Set(next)].sort()); setTimes({}); setPreview([]); setError(""); }
  function chooseVipPlan() { setUseVipPlan(true); setServiceIds([]); setPreview([]); }
  async function loadPreview() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await previewRecurringAppointmentsAction({ ...customerPayload, barberId, serviceIds, useVipPlan, dates });
      if (!result.ok) { setError(result.message); return; }
      setPreview(result.data); setTimes((current) => Object.fromEntries(dates.map((date) => [date, current[date] || commonTime]))); setStep(3);
    } catch { setError("Não foi possível consultar os horários. Tente novamente."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save() {
    if (lock.current || !allAvailable) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await createRecurringAppointmentsAction({ ...customerPayload, barberId, serviceIds, useVipPlan, repeatForever, ...(repeatForever ? { intervalDays: Number(mode) } : {}), requestId: requestId.current, notes, occurrences: dates.map((date) => ({ date, time: times[date] })) });
      if (!result.ok) { setError(result.message); return; }
      setSuccess(result.data.count); router.refresh();
    } catch { setError("Não foi possível confirmar. Tente novamente; a mesma sequência não será duplicada."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 px-3 py-4 backdrop-blur-sm">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="recurring-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-3xl border border-white/15 bg-[#141414] text-white shadow-2xl" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), [tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5"><div><p className="text-xs uppercase tracking-widest text-zinc-400">Clientes fixos</p><h2 id="recurring-title" ref={heading} tabIndex={-1} className="mt-1 text-xl font-bold outline-none">{success ? repeatForever ? "Recorrência ativada" : "Sequência confirmada" : "Agendamento recorrente"}</h2>{!success && <p className="mt-2 text-sm text-zinc-400">Etapa {step} de 3 · {step === 1 ? "Cliente e atendimento" : step === 2 ? "Escolha as datas" : "Horários e confirmação"}</p>}</div><button type="button" aria-label="Fechar agendamento recorrente" disabled={busy} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10"><X size={20} /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"><fieldset disabled={busy} className="min-w-0 space-y-5">
        {success ? <div className="space-y-4 py-4"><CheckCircle2 className="h-10 w-10 text-emerald-400" /><p className="text-lg font-semibold">{success} agendamentos criados.</p><p className="text-sm text-zinc-300">{guest ? "As visitas aparecem na agenda do barbeiro com o nome informado, sem criar conta." : "As visitas aparecem na agenda do barbeiro e em Meus agendamentos do cliente."} Cada visita pode ser cancelada individualmente.</p>{repeatForever && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">A recorrência continua até você cancelar. Novas datas serão incluídas automaticamente.</p>}<Link href="/admin/recorrentes" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4"><Repeat2 size={16} />Gerenciar recorrências</Link></div> : <>
          {step === 1 && <>
            <div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={!guest} className={!guest ? "btn-primary !text-black" : "btn-secondary"} onClick={() => { setCustomerMode("registered"); setPreview([]); }}>Cliente cadastrado</button><button type="button" aria-pressed={guest} className={guest ? "btn-primary !text-black" : "btn-secondary"} onClick={() => { setCustomerMode("guest"); setUseVipPlan(false); setPreview([]); }}>Cliente sem cadastro</button></div>
            {guest ? <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Nome do cliente<input value={customerName} maxLength={80} onChange={(event) => setCustomerName(event.target.value)} placeholder="Ex.: João" autoComplete="off" className="form-control mt-2 w-full" /></label><label className="block text-sm font-medium">Telefone (opcional)<input value={customerPhone} maxLength={30} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="(11) 99999-9999" inputMode="tel" className="form-control mt-2 w-full" /></label></div> : <>
              <label className="block text-sm font-medium">Buscar cliente cadastrado<span className="relative mt-2 block"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input type="search" inputMode="text" autoComplete="off" autoCorrect="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, telefone ou e-mail" className="form-control w-full !pl-10" /></span></label>
              {selectedCustomer && <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">Selecionado: {selectedCustomer.name} · {selectedCustomer.phone || selectedCustomer.email || "Cliente cadastrado"}</p>}
              <div className="space-y-2"><p aria-live="polite" className="flex items-center gap-2 text-xs text-zinc-400">{searchBusy ? <><LoaderCircle size={14} className="animate-spin" />Buscando clientes...</> : `${searchTotal} ${searchTotal === 1 ? "cliente encontrado" : "clientes encontrados"}`}</p><div className="max-h-52 space-y-2 overflow-y-auto">{matches.map((customer) => <button key={customer.id} type="button" aria-pressed={customerId === customer.id} onClick={() => { setSelectedCustomer(customer); setUseVipPlan(false); }} className={`block w-full rounded-xl border p-3 text-left text-sm ${customerId === customer.id ? "border-white/60 bg-white/15" : "border-white/10 hover:bg-white/5"}`}><span className="block break-words font-semibold">{customer.name}</span><span className="mt-1 block break-all text-xs text-zinc-400">{customer.phone || customer.email || "Sem contato informado"}</span></button>)}{hasMore && <button type="button" disabled={searchBusy} onClick={() => void loadMoreCustomers()} className="btn-secondary w-full text-sm">{searchBusy ? "Carregando..." : "Carregar mais clientes"}</button>}{!searchBusy && !matches.length && !searchError && <p className="py-3 text-sm text-zinc-400">Nenhum cliente encontrado.</p>}</div>{searchError && <p role="alert" className="text-sm text-red-300">{searchError}</p>}</div>
            </>}
            <PremiumSelect label="Barbeiro" value={barberId} onChange={(id) => { setBarberId(id); setServiceIds([]); setUseVipPlan(false); setPreview([]); }} options={barbers.map((barber) => ({ value: barber.id, label: barber.name || barber.email || "Barbeiro" }))} />
            {customerPlan && <div className={`rounded-2xl border p-4 ${useVipPlan ? "border-emerald-300/35 bg-emerald-300/10" : "border-amber-300/25 bg-amber-300/5"}`}><p className="text-xs font-bold uppercase tracking-widest text-amber-200">Plano ativo: {customerPlan.name}</p><p className="mt-1 text-sm text-zinc-300">Item incluído: {getPlanItemLabel(customerPlan.code)}</p><button type="button" className={useVipPlan ? "btn-primary mt-3 !text-black" : "btn-secondary mt-3"} onClick={() => useVipPlan ? setUseVipPlan(false) : chooseVipPlan()}>{useVipPlan ? "Usando item do plano" : "Usar item do plano"}</button>{useVipPlan && <p className="mt-2 text-xs text-emerald-100">O preço normal não será cobrado. O limite semanal e o consumo do plano continuam sendo validados.</p>}</div>}
            {!useVipPlan && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Serviços em todas as visitas</legend>{availableServices.map((service) => <label key={service.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" checked={serviceIds.includes(service.id)} disabled={!serviceIds.includes(service.id) && serviceIds.length >= 8} onChange={(event) => { setServiceIds((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id)); setPreview([]); }} className="h-4 w-4 accent-white" /><span className="min-w-0 flex-1 text-sm">{service.name}</span><span className="shrink-0 text-xs text-zinc-400">{formatCurrency(service.price)} · {service.duration} min</span></label>)}</fieldset>}
          </>}
          {step === 2 && <>
            <PremiumSelect label="Repetição" value={mode} onChange={(value) => { setMode(value); setDateList([]); if (value === "manual") setRepeatForever(false); }} options={[{ value: "7", label: "Toda semana (7 dias)" }, { value: "14", label: "A cada 2 semanas (14 dias)" }, { value: "15", label: "A cada 15 dias" }, { value: "manual", label: "Escolher datas avulsas" }]} />
            {mode !== "manual" && <div className="grid grid-cols-2 gap-2"><button type="button" className={!repeatForever ? "btn-primary !text-black" : "btn-secondary"} onClick={() => { setRepeatForever(false); setDateList([]); }}>Definir visitas</button><button type="button" className={`${repeatForever ? "btn-primary !text-black" : "btn-secondary"} gap-2`} onClick={() => { setRepeatForever(true); setDateList([]); }}><InfinityIcon size={18} />Sempre</button></div>}
            {repeatForever && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm leading-6 text-emerald-100">Sem data para terminar. A agenda continuará recebendo as visitas até o administrador cancelar.</p>}
            <div className="grid gap-3 sm:grid-cols-2"><PremiumDatePicker label={mode === "manual" ? "Adicionar data" : "Primeira visita"} value={start} onChange={(value) => { setStart(value); if (mode !== "manual") setDateList([]); }} min={today} max={addRecurringDays(today, 180)} />{mode !== "manual" && !repeatForever && <PremiumSelect label="Quantidade de visitas" value={count} onChange={(value) => { setCount(value); setDateList([]); }} options={Array.from({ length: 11 }, (_, index) => ({ value: String(index + 2), label: `${index + 2} visitas` }))} />}</div>
            <button type="button" className="btn-secondary w-full" disabled={!start || (mode === "manual" && dates.length >= MAX_RECURRING_VISITS)} onClick={() => { const next = mode === "manual" ? [...dates, start] : generateRecurringDates(start, Number(mode), repeatForever ? Math.max(2, Math.min(MAX_RECURRING_VISITS, Math.floor((Date.parse(`${addRecurringDays(today, 180)}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000 / Number(mode)) + 1)) : Number(count)); if (next.some((date) => date > addRecurringDays(today, 180))) { setError("Escolha uma sequência dentro dos próximos 180 dias."); return; } setDateList(next); }}>{mode === "manual" ? "Adicionar data" : repeatForever ? "Ver próximas datas" : dates.length ? "Atualizar sequência" : "Gerar datas"}</button>
            <p className="text-sm text-zinc-400">{repeatForever ? "Estas são as primeiras visitas. As próximas serão adicionadas automaticamente." : "De 2 a 12 visitas nos próximos 180 dias."}</p><ul className="space-y-2">{dates.map((date) => <li key={date} className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 px-3"><span className="text-sm">{dateLabel(date)}</span>{!repeatForever && <button type="button" aria-label={`Remover ${dateLabel(date)}`} className="flex h-11 w-11 items-center justify-center text-zinc-400" onClick={() => setDateList(dates.filter((value) => value !== date))}><X size={16} /></button>}</li>)}</ul><PremiumTimePicker label="Horário inicial para todas as visitas" value={commonTime} onChange={(value) => { setCommonTime(value); setTimes({}); }} />
          </>}
          {step === 3 && <><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="font-semibold">{guest ? customerName : selectedCustomer?.name}</p><p className="mt-1 text-sm text-zinc-300">{barbers.find((barber) => barber.id === barberId)?.name} · {useVipPlan ? customerPlan?.name : selectedServices.map((service) => service.name).join(" + ")}</p><p className="mt-2 text-sm text-zinc-400">{repeatForever ? "Sempre" : `${dates.length} visitas`} · {useVipPlan ? "item do plano" : `${duration} min e ${formatCurrency(price)} por visita`}</p></div><div className="grid items-end gap-3 sm:grid-cols-2"><PremiumTimePicker label="Mesmo horário para todas" value={commonTime} onChange={(value) => { setCommonTime(value); if (repeatForever) setTimes(Object.fromEntries(dates.map((date) => [date, value]))); }} /><button type="button" disabled={busy} className="btn-secondary" onClick={() => setTimes(Object.fromEntries(dates.map((date) => [date, commonTime])))}>Aplicar a todas</button></div><p className="text-sm text-zinc-400">Você pode escolher um horário diferente em cada data. Apenas horários disponíveis podem ser confirmados.</p>{preview.map((day) => { const available = day.slots.includes(times[day.date]); const options = day.slots.map((time) => ({ value: time, label: time })); if (!available) options.unshift({ value: times[day.date] || "", label: times[day.date] ? `${times[day.date]} · indisponível` : "Selecione um horário" }); return <div key={day.date} className={`rounded-2xl border p-3 ${available ? "border-white/10" : "border-amber-400/40 bg-amber-400/5"}`}><div className="grid items-center gap-3 sm:grid-cols-2"><p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} />{dateLabel(day.date)}</p><PremiumSelect label="Horário da visita" value={times[day.date] || ""} options={options} disabled={busy || !day.slots.length} onChange={(time) => setTimes((current) => ({ ...current, [day.date]: time }))} /></div>{!available && <p className="mt-2 text-sm text-amber-200">{day.message || "Horário ocupado ou fora do atendimento."}</p>}</div>; })}<label className="block text-sm">Observação para todas as visitas<textarea maxLength={200} value={notes} onChange={(event) => setNotes(event.target.value)} className="form-control mt-2 w-full" rows={2} /></label><p className="text-sm text-zinc-400">{guest ? "A confirmação reserva todas as visitas na agenda do barbeiro." : "A confirmação reserva todas as visitas e elas aparecem na conta do cliente."} Se surgir conflito, nenhuma visita desta sequência será criada.</p><button type="button" disabled={busy} onClick={loadPreview} className="text-sm underline underline-offset-4">Atualizar disponibilidade</button></>}
          {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        </>}
      </fieldset></div>
      <footer className="flex shrink-0 gap-3 border-t border-white/10 p-4 sm:p-5">{success ? <button type="button" className="btn-primary w-full !text-black" onClick={onClose}>Concluir</button> : <><button type="button" className="btn-secondary flex-1" disabled={busy} onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? "Cancelar" : "Voltar"}</button><button type="button" className="btn-primary flex-1 !text-black" disabled={busy || (step === 1 && (!customerValid || !barberId || (!serviceIds.length && !useVipPlan))) || (step === 2 && dates.length < 2) || (step === 3 && !allAvailable)} onClick={() => { if (step === 1) { setError(""); setStep(2); } else if (step === 2) void loadPreview(); else void save(); }}>{busy ? "Aguarde..." : step === 1 ? "Escolher datas" : step === 2 ? "Consultar horários" : repeatForever ? "Ativar recorrência" : `Confirmar ${dates.length} visitas`}</button></>}</footer>
    </div>
  </div>;
}
