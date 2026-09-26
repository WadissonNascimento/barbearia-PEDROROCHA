"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, Clock3, LoaderCircle, Pencil, Plus, Search, X } from "lucide-react";
import FeedbackMessage from "@/components/FeedbackMessage";
import { isComboService } from "@/lib/servicePresentation";
import type { MutationResult } from "@/lib/mutationResult";
import {
  createAdminServiceAction,
  deleteGlobalServiceAction,
  toggleGlobalServiceAction,
  updateGlobalServiceAction,
} from "./actions";

type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  commissionValue: number;
  isActive: boolean;
  barber: BarberOption | null;
};
type BarberOption = { id: string; name: string | null; email: string | null };
type Feedback = { key: string; result: MutationResult } | null;
type RunAction = (
  key: string,
  action: (formData: FormData) => Promise<MutationResult>,
  formData: FormData,
  onSuccess?: () => void,
  onStart?: () => void
) => void;

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default function AdminServicesClient({ globalServices, barberServices, barbers }: {
  globalServices: ServiceItem[];
  barberServices: ServiceItem[];
  barbers: BarberOption[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [createKind, setCreateKind] = useState<"SERVICE" | "COMBO">("SERVICE");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceScope, setServiceScope] = useState<"GLOBAL" | "EXCLUSIVE">("GLOBAL");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const allServices = [...globalServices, ...barberServices];
  const activeCount = allServices.filter((service) => service.isActive).length;

  const runAction: RunAction = (key, action, formData, onSuccess, onStart) => {
    if (actionLock.current || isPending) return;
    actionLock.current = true;
    setPendingKey(key);
    setFeedback(null);
    startTransition(async () => {
      onStart?.();
      try {
        const result = await action(formData);
        setFeedback({ key, result });
        if (result.ok) {
          onSuccess?.();
          router.refresh();
        }
      } catch {
        setFeedback({ key, result: { ok: false, tone: "error", message: "Não foi possível salvar. Verifique sua conexão e tente novamente." } });
      } finally {
        actionLock.current = false;
      }
    });
  };

  const matches = (service: ServiceItem) =>
    normalize(`${service.name} ${service.barber?.name || ""}`).includes(normalize(search.trim())) &&
    (filter === "all" || service.isActive === (filter === "active"));
  const sections = [
    { title: "Serviços", services: globalServices.filter((service) => !isComboService(service)) },
    { title: "Combos", services: globalServices.filter(isComboService) },
    { title: "Exclusivos dos barbeiros", services: barberServices },
  ].map((section) => ({ ...section, services: section.services.filter(matches) }));

  return (
    <div className="admin-services mt-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">
          <span className="font-semibold text-white">{activeCount} {activeCount === 1 ? "ativo" : "ativos"}</span>
          <span className="mx-2 text-zinc-600">·</span>
          {allServices.length - activeCount} {allServices.length - activeCount === 1 ? "inativo" : "inativos"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([ ["SERVICE", "Novo serviço"], ["COMBO", "Novo combo"] ] as const).map(([kind, label]) => (
            <button key={kind} type="button" className={`${kind === "COMBO" ? "btn-primary" : "btn-secondary"} gap-2 px-3`}
              aria-expanded={showCreate && createKind === kind} aria-controls="new-service-form" disabled={isPending}
              onClick={() => {
                setShowCreate(!showCreate || createKind !== kind);
                setCreateKind(kind);
                setFeedback(null);
              }}>
              {showCreate && createKind === kind ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {showCreate && (
        <section id="new-service-form" className="rounded-2xl border border-white/15 bg-white/[0.035] p-4 sm:p-5">
          <form key={createKind} className="space-y-5" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction("create-service", createAdminServiceAction, new FormData(form), () => {
              form.reset();
              setServiceScope("GLOBAL");
            });
          }}>
            <div>
              <h2 className="text-lg font-bold text-white">{createKind === "COMBO" ? "Novo combo" : "Novo serviço"}</h2>
              {createKind === "COMBO" && <p className="mt-2 text-sm leading-6 text-zinc-400">Defina o nome, o preço e a duração total do combo. Ele aparecerá na seção Combos para os clientes.</p>}
            </div>
            <input type="hidden" name="serviceKind" value={createKind} />
            <fieldset disabled={isPending} className="space-y-4">
              <Field label="Quem pode atender?">
                <select className="service-edit-control" name="serviceScope" value={serviceScope} onChange={(event) => setServiceScope(event.target.value as "GLOBAL" | "EXCLUSIVE")}>
                  <option value="GLOBAL">Todos os barbeiros</option>
                  <option value="EXCLUSIVE">Um barbeiro específico</option>
                </select>
              </Field>
              {serviceScope === "EXCLUSIVE" && (
                <Field label="Barbeiro responsável">
                  <select name="barberId" required defaultValue="" className="service-edit-control">
                    <option value="" disabled>Selecione o barbeiro</option>
                    {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name || barber.email || "Barbeiro"}</option>)}
                  </select>
                </Field>
              )}
              <ServiceFields isCombo={createKind === "COMBO"} />
              <button type="submit" className="btn-primary w-full sm:w-auto">{isPending && pendingKey === "create-service" ? "Criando..." : createKind === "COMBO" ? "Criar combo" : "Criar serviço"}</button>
            </fieldset>
          </form>
          {feedback?.key === "create-service" && <div className="mt-4"><FeedbackMessage {...feedback.result} /></div>}
        </section>
      )}

      {feedback?.key.startsWith("delete-") && <FeedbackMessage {...feedback.result} />}

      <div className="space-y-4">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 focus-within:border-white/40">
          <Search size={18} className="shrink-0 text-zinc-500" aria-hidden="true" />
          <span className="sr-only">Buscar serviço ou barbeiro</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar serviço" className="min-w-0 w-full bg-transparent py-3 text-base text-white outline-none placeholder:text-zinc-500" />
        </label>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1" aria-label="Filtrar serviços">
          {([ ["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"] ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} disabled={isPending} className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${filter === value ? "bg-white/15 text-white shadow-sm" : "text-zinc-400 hover:text-white"}`}>{label}</button>
          ))}
        </div>
      </div>

      {sections.every((section) => section.services.length === 0) && (
        <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-zinc-400">{allServices.length ? "Nenhum serviço encontrado com esses filtros." : "Cadastre seu primeiro serviço para começar."}</p>
      )}
      {sections.filter((section) => section.services.length > 0).map((section) => (
        <section key={section.title} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">{section.title}</h2>
            <span className="text-sm text-zinc-500">{section.services.length}</span>
          </div>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {section.services.map((service) => (
              <ServiceCard key={service.id} service={service} isEditing={editingServiceId === service.id} isPending={isPending} pendingKey={pendingKey} feedback={feedback}
                onStartEditing={() => setEditingServiceId(service.id)} onCancelEditing={() => setEditingServiceId(null)} onRunAction={runAction} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ServiceCard({ service, isEditing, isPending, pendingKey, feedback, onStartEditing, onCancelEditing, onRunAction }: {
  service: ServiceItem;
  isEditing: boolean;
  isPending: boolean;
  pendingKey: string | null;
  feedback: Feedback;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onRunAction: RunAction;
}) {
  const [active, setActive] = useOptimistic(service.isActive);
  const savingToggle = isPending && pendingKey === `toggle-${service.id}`;
  const localFeedback = feedback && [ `toggle-${service.id}`, `update-${service.id}` ].includes(feedback.key) ? feedback.result : null;

  return (
    <article className={`min-w-0 rounded-2xl border p-4 transition sm:p-5 ${active ? "border-white/15 bg-white/[0.035]" : "border-white/10 bg-black/20"}`}>
      {isComboService(service) && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-300">Combo</p>}
      <h3 className={`break-words text-lg font-semibold leading-6 ${active ? "text-white" : "text-zinc-400"}`}>{service.name}</h3>
      {service.barber && <p className="mt-2 break-words text-sm text-zinc-400">Exclusivo de {service.barber.name || service.barber.email || "Barbeiro"}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-lg font-bold text-white">{money(service.price)}</p>
        <p className="flex items-center gap-1.5 text-sm text-zinc-400"><Clock3 size={15} aria-hidden="true" />{service.duration} min</p>
        <p className="text-sm text-zinc-400">Comissão {service.commissionValue}%</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <button type="button" role="switch" aria-checked={active} aria-label={`Disponibilidade de ${service.name}`} aria-busy={savingToggle} disabled={isPending}
          className="flex min-h-12 items-center gap-3 rounded-xl pr-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait"
          onClick={() => {
            const formData = new FormData();
            formData.set("serviceId", service.id);
            formData.set("isActive", String(!active));
            onRunAction(`toggle-${service.id}`, toggleGlobalServiceAction, formData, undefined, () => setActive(!active));
          }}>
          <span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${active ? "bg-emerald-500" : "bg-zinc-700"}`}>
            <span className={`h-5 w-5 rounded-full shadow transition-transform motion-reduce:transition-none ${active ? "translate-x-5 bg-white" : "bg-zinc-400"}`} />
          </span>
          <span className={active ? "text-emerald-300" : "text-zinc-400"}>{active ? "Ativo" : "Inativo"}</span>
        </button>
        <button type="button" disabled={isPending} aria-expanded={isEditing} aria-controls={`edit-${service.id}`} onClick={isEditing ? onCancelEditing : onStartEditing}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          {isEditing ? <X size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}{isEditing ? "Fechar" : "Editar"}
        </button>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs leading-5 text-zinc-400" role="status">
        {savingToggle ? <><LoaderCircle size={13} className="animate-spin" aria-hidden="true" />Salvando...</> : localFeedback?.ok ? <><Check size={13} className="text-emerald-400" aria-hidden="true" />{localFeedback.message}</> : active ? "Disponível para novos agendamentos." : "Oculto para novos agendamentos."}
      </p>
      {localFeedback && !localFeedback.ok && <div className="mt-3"><FeedbackMessage {...localFeedback} /></div>}
      {isEditing && (
        <form id={`edit-${service.id}`} className="mt-5 border-t border-white/10 pt-5" onSubmit={(event) => {
          event.preventDefault();
          onRunAction(`update-${service.id}`, updateGlobalServiceAction, new FormData(event.currentTarget), onCancelEditing);
        }}>
          <input type="hidden" name="serviceId" value={service.id} />
          <fieldset disabled={isPending} className="space-y-4">
            <ServiceFields service={service} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onCancelEditing} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{isPending && pendingKey === `update-${service.id}` ? "Salvando..." : "Salvar"}</button>
            </div>
            <button type="button" className="min-h-11 w-full rounded-xl px-3 text-sm text-red-300 hover:bg-red-500/10" onClick={() => {
              if (!window.confirm("Excluir serviço? Se houver agendamentos no histórico, ele será apenas desativado.")) return;
              const formData = new FormData();
              formData.set("serviceId", service.id);
              onRunAction(`delete-${service.id}`, deleteGlobalServiceAction, formData, onCancelEditing);
            }}>{isPending && pendingKey === `delete-${service.id}` ? "Excluindo..." : "Excluir serviço"}</button>
          </fieldset>
        </form>
      )}
    </article>
  );
}

function ServiceFields({ service, isCombo = service ? isComboService(service) : false }: { service?: ServiceItem; isCombo?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <input type="hidden" name="description" value={service?.description || ""} />
      <Field label={isCombo ? "Nome do combo" : "Nome do serviço"} className="col-span-2">
        <input name="name" defaultValue={service?.name} required maxLength={120} className="service-edit-control" placeholder={isCombo ? "Ex.: Cabelo + barba + hidratação" : "Ex.: Corte de cabelo"} />
      </Field>
      <Field label="Preço (R$)">
        <input type="number" inputMode="decimal" step="0.01" min="1" name="price" defaultValue={service?.price} required className="service-edit-control" />
      </Field>
      <Field label="Duração (min)">
        <input type="number" inputMode="numeric" min="10" step="5" name="duration" defaultValue={service?.duration} required className="service-edit-control" />
      </Field>
      <Field label="Comissão (%)" className="col-span-2">
        <input type="number" inputMode="numeric" min="0" max="100" step="1" name="commissionValue" defaultValue={service?.commissionValue ?? 40} required className="service-edit-control" />
      </Field>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block min-w-0 ${className}`}><span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>{children}</label>;
}
